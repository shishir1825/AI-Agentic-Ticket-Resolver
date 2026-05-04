from __future__ import annotations

"""Deterministic priority scoring engine.

Weights and thresholds are configurable via ScoringConfig.
Scoring inputs are derived from the artifact content via heuristic signal
extraction PLUS optional LLM-provided scoring hints.
"""

from typing import Any, Optional, Dict


DEFAULT_WEIGHTS = {
    "arr":                30,
    "escalation":         25,
    "strategic":          20,
    "severity":           15,
    "affected_customers": 10,
}

DEFAULT_THRESHOLDS = {
    "high":   70,
    "medium": 40,
}

# LLM signal strings → numeric input values
_SIGNAL_MAP = {
    "very_high": 90,
    "high":      75,
    "medium":    50,
    "low":       25,
    "very_low":  10,
}


def compute_priority_score(
    inputs: Dict[str, float],
    weights: Optional[Dict[str, float]] = None,
    thresholds: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """Compute weighted priority score and assign priority bucket.

    Args:
        inputs: raw dimension scores 0-100.
            Keys: arr, escalation, strategic, severity, affected_customers
        weights: weight per dimension (should sum to 100).
        thresholds: {"high": N, "medium": M}.

    Returns dict with priority_score, priority, score_breakdown, normalized_inputs.
    """
    w = weights or DEFAULT_WEIGHTS
    t = thresholds or DEFAULT_THRESHOLDS

    total_weight = sum(w.values()) or 1
    breakdown: Dict[str, float] = {}
    weighted_sum = 0.0

    for dim, weight in w.items():
        raw = max(0.0, min(100.0, float(inputs.get(dim, 0))))
        contribution = raw * (weight / total_weight)
        breakdown[dim] = round(contribution, 2)
        weighted_sum += contribution

    score = round(weighted_sum, 2)
    high_threshold   = t.get("high", 70)
    medium_threshold = t.get("medium", 40)

    if score >= high_threshold:
        priority = "high"
    elif score >= medium_threshold:
        priority = "medium"
    else:
        priority = "low"

    return {
        "priority_score":    score,
        "priority":          priority,
        "score_breakdown":   breakdown,
        "normalized_inputs": {dim: max(0.0, min(100.0, float(inputs.get(dim, 0)))) for dim in w},
    }


def estimate_inputs_from_artifact(
    artifact: dict,
    llm_hints: Optional[Dict[str, str]] = None,
) -> Dict[str, float]:
    """Derive scoring dimension inputs (0-100 each) from artifact content.

    Strategy:
    1. Heuristic text signals from problem_statement, title, impact, stakeholders.
    2. LLM scoring hints (arr_signal, escalation_signal, etc.) override heuristics
       when provided by Agent-2.
    """
    inputs: Dict[str, float] = {}

    # ── Build searchable text blob ─────────────────────────────────────
    impact   = artifact.get("impact", {})
    all_text = " ".join(filter(None, [
        artifact.get("title", ""),
        artifact.get("problem_statement", ""),
        impact.get("who_is_affected", ""),
        impact.get("severity_hint", ""),
        " ".join(artifact.get("questions_to_ask", [])),
        " ".join(r.get("text", "") for r in artifact.get("requirements", []) if isinstance(r, dict)),
    ])).lower()

    type_hint = (artifact.get("request_type_hint", "") or "").lower()

    # ── 1. SEVERITY ────────────────────────────────────────────────────
    severity_hint = (impact.get("severity_hint", "") or "").lower()
    severity_map  = {"critical": 90, "high": 75, "medium": 55, "low": 25}
    severity_base = severity_map.get(severity_hint, 45)

    # Boost for production bugs
    if type_hint == "production_bug":
        severity_base = max(severity_base, 75)
    elif type_hint == "bug":
        severity_base = max(severity_base, 55)

    # Extra signal from text
    if any(w in all_text for w in ["data loss", "billing failure", "production down", "cannot bill"]):
        severity_base = max(severity_base, 85)
    if any(w in all_text for w in ["workaround", "regenerat", "recreat", "deleted and recreated"]):
        severity_base = min(severity_base, 60)   # manual fix exists → lower severity

    inputs["severity"] = severity_base

    # ── 2. ESCALATION ──────────────────────────────────────────────────
    escalation_base = {
        "production_bug":  80,
        "cri":             65,
        "bug":             45,
        "feature_request": 20,
    }.get(type_hint, 30)

    # Text-based escalation boosters
    esc_boost = 0
    if any(w in all_text for w in ["vip", "ase l2", "l2 ticket", "escalat", "negative sentiment", "urgent", "severity 1"]):
        esc_boost += 25
    if any(w in all_text for w in ["blocker", "critical", "p0", "p1", "showstopper"]):
        esc_boost += 20
    if any(w in all_text for w in ["customer complaint", "churn risk", "threatened to cancel"]):
        esc_boost += 15

    inputs["escalation"] = min(escalation_base + esc_boost, 100)

    # ── 3. ARR ─────────────────────────────────────────────────────────
    arr = 40  # unknown customer tier → conservative default
    if any(w in all_text for w in ["vip", "enterprise", "key account", "strategic customer", "major customer"]):
        arr = 80
    elif any(w in all_text for w in ["multiple customers", "many customers", "several merchants", "all merchant"]):
        arr = 65
    elif any(w in all_text for w in ["merchant", "customer"]):
        arr = 50   # at least one real customer
    inputs["arr"] = arr

    # ── 4. STRATEGIC ───────────────────────────────────────────────────
    strategic = 45  # default
    if any(w in all_text for w in ["compliance", "regulation", "gdpr", "einvoic", "e-invoic", "tax", "legal", "mandate"]):
        strategic = 80   # regulatory / compliance = high strategic impact
    elif any(w in all_text for w in ["competitive", "roadmap", "api", "webhook", "integration", "template builder"]):
        strategic = 65
    elif type_hint == "feature_request":
        strategic = max(strategic, 40)
    inputs["strategic"] = strategic

    # ── 5. AFFECTED CUSTOMERS ──────────────────────────────────────────
    stakeholders = artifact.get("stakeholders", [])
    affected = 40

    # Numeric mentions
    import re
    count_match = re.search(r"(\d+)\s+(invoice|customer|merchant|case|ticket)", all_text)
    if count_match:
        n = int(count_match.group(1))
        if n >= 50:   affected = 85
        elif n >= 10: affected = 70
        elif n >= 3:  affected = 55

    if any(w in all_text for w in ["all merchant", "all customer", "hundreds", "thousands"]):
        affected = 90
    elif any(w in all_text for w in ["multiple", "several", "many"]):
        affected = max(affected, 60)

    if len(stakeholders) >= 4:
        affected = max(affected, 65)
    elif len(stakeholders) >= 2:
        affected = max(affected, 50)

    inputs["affected_customers"] = min(affected, 100)

    # ── LLM hint overrides ─────────────────────────────────────────────
    # If Agent-2's LLM returned scoring signals, they take precedence.
    if llm_hints:
        dim_map = {
            "arr_signal":                "arr",
            "escalation_signal":         "escalation",
            "strategic_signal":          "strategic",
            "severity_signal":           "severity",
            "affected_customers_signal": "affected_customers",
        }
        for hint_key, dim in dim_map.items():
            if hint_key in llm_hints and llm_hints[hint_key] in _SIGNAL_MAP:
                # Blend: 60% LLM hint, 40% heuristic
                heuristic  = inputs.get(dim, 50)
                llm_val    = _SIGNAL_MAP[llm_hints[hint_key]]
                inputs[dim] = round(0.6 * llm_val + 0.4 * heuristic, 1)

    return inputs
