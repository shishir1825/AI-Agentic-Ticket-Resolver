import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  Code2,
  FileCode2,
  AlertCircle,
  Database,
  Bug,
  ShieldAlert,
  GitPullRequest,
  FileText,
  Sparkles,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Brain,
  Search,
  Zap,
  RefreshCw,
  Terminal,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/workflow/StatusBadge";
import StepIndicator from "@/components/workflow/StepIndicator";
import { useRuns, useRun, useAnalyzeCode } from "@/api/runs";
import { type Role } from "@/lib/constants";
import { cn, formatDate, shortId, truncate } from "@/lib/utils";

const PAGE_TITLE = "AutoResolve";
const PAGE_DESC = "AI-powered root cause analysis & automated fix generation";

interface CodeFixProps {
  role: Role;
}

function getCodeAnalysisArtifact(
  artifacts:
    | { stage: string; json_payload: Record<string, unknown> }[]
    | undefined
) {
  return artifacts?.find((a) => a.stage === "code_analysis");
}

function getFileIconClass(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["java", "groovy", "kt", "scala"].includes(ext)) return "text-orange-600";
  if (["ts", "tsx", "js", "jsx"].includes(ext)) return "text-blue-600";
  if (["vue"].includes(ext)) return "text-green-600";
  if (["py"].includes(ext)) return "text-amber-600";
  return "text-muted-foreground";
}

type FilterTab = "all" | "analyzed" | "not_analyzed";

export default function CodeFix({ role }: CodeFixProps) {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());

  const { data: runs = [], isLoading: runsLoading } = useRuns();
  const { data: detailRun, isLoading: detailLoading } = useRun(
    runId ?? expandedRun ?? undefined
  );
  const analyzeCode = useAnalyzeCode();

  const triggerAnalysis = useCallback(
    (id: string) => {
      setAnalyzingIds((prev) => new Set(prev).add(id));
      analyzeCode.mutate(id);
    },
    [analyzeCode]
  );

  useEffect(() => {
    if (analyzingIds.size === 0) return;
    setAnalyzingIds((prev) => {
      const next = new Set(prev);
      for (const id of prev) {
        const r = runs.find((run) => run.id === id);
        if (!r) continue;
        const hasArtifact = r.artifacts?.some((a) => a.stage === "code_analysis");
        if (hasArtifact || r.status !== "awaiting_code_fix") {
          next.delete(id);
        }
      }
      return next.size !== prev.size ? next : prev;
    });
  }, [runs, analyzingIds]);

  if (role === "gtm") {
    return (
      <div className="space-y-6">
        <PageHeader title={PAGE_TITLE} description={PAGE_DESC} />
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="flex items-center gap-4 pt-6">
            <AlertCircle className="h-10 w-10 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-900">Access Restricted</p>
              <p className="text-sm text-amber-800">
                {PAGE_TITLE} is available to PM, Engineering, and Admin roles.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const eligibleStatuses = ["awaiting_code_fix", "awaiting_eng_review", "awaiting_em_signoff", "done"];
  const doneRuns = runs.filter((r) => eligibleStatuses.includes(r.status));

  const totalAnalyzed = doneRuns.filter((r) =>
    r.artifacts?.some((a) => a.stage === "code_analysis")
  ).length;
  const validIssuesFound = doneRuns.filter((r) => {
    const art = getCodeAnalysisArtifact(r.artifacts ?? []);
    return (art?.json_payload as Record<string, unknown> | undefined)
      ?.is_valid_issue === true;
  }).length;
  const prsGenerated = doneRuns.filter((r) => {
    const art = getCodeAnalysisArtifact(r.artifacts ?? []);
    const u = (art?.json_payload as Record<string, unknown> | undefined)
      ?.pr_url;
    return u != null && String(u).trim() !== "";
  }).length;

  const filteredRuns =
    filterTab === "analyzed"
      ? doneRuns.filter((r) =>
          r.artifacts?.some((a) => a.stage === "code_analysis")
        )
      : filterTab === "not_analyzed"
        ? doneRuns.filter(
            (r) => !r.artifacts?.some((a) => a.stage === "code_analysis")
          )
        : doneRuns;

  const activeRunId = runId ?? expandedRun;
  const activeRun = activeRunId ? (detailRun?.id === activeRunId ? detailRun : runs.find((r) => r.id === activeRunId)) : null;
  const codeArt = activeRun
    ? getCodeAnalysisArtifact(activeRun.artifacts ?? [])
    : undefined;
  const codePayload = codeArt?.json_payload as
    | Record<string, unknown>
    | undefined;
  const dataAnalysis = codePayload?.data_analysis as
    | Record<string, unknown>
    | undefined;
  const activeAnalyzingId = activeRunId && analyzingIds.has(activeRunId) ? activeRunId : null;
  const isAnalyzing = analyzeCode.isPending || analyzingIds.size > 0;
  const isActiveRunAnalyzing = analyzeCode.isPending || Boolean(activeAnalyzingId);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-indigo-600 via-blue-600 to-violet-700 text-white shadow-xl">
        <CardContent className="py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                <Zap className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{PAGE_TITLE}</h1>
                <p className="text-sm text-white/80">{PAGE_DESC}</p>
              </div>
            </div>
            <div className="flex gap-3">
              {[
                { n: totalAnalyzed, l: "Analyzed", icon: Search },
                { n: validIssuesFound, l: "Valid", icon: CheckCircle2 },
                { n: prsGenerated, l: "PRs", icon: GitPullRequest },
              ].map((s) => (
                <div
                  key={s.l}
                  className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm"
                >
                  <s.icon className="h-4 w-4 text-white/70" />
                  <div className="text-center">
                    <p className="text-xl font-bold leading-tight count-up">{s.n}</p>
                    <p className="text-[10px] text-white/60">{s.l}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Global analysis-in-progress indicator */}
      {isAnalyzing && (
        <div className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50/70 px-4 py-3">
          <div className="brain-pulse flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-indigo-900">{PAGE_TITLE} is running</span>
              <span className="flex gap-0.5">
                <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-indigo-500" />
                <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-indigo-500" />
                <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-indigo-500" />
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Scanning codebase and generating fix — results appear automatically</p>
          </div>
          <div className="h-1 w-24 overflow-hidden rounded-full bg-indigo-100">
            <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-indigo-400 via-violet-500 to-indigo-400 shimmer-bar" />
          </div>
        </div>
      )}

      {/* Single-page layout: list left, detail right */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        {/* LEFT — Run list */}
        <div className="space-y-3">
          {/* Filter tabs */}
          <div className="flex gap-1.5">
            {(
              [
                { key: "all" as FilterTab, label: "All", count: doneRuns.length },
                { key: "analyzed" as FilterTab, label: "Analyzed", count: totalAnalyzed },
                { key: "not_analyzed" as FilterTab, label: "Pending", count: doneRuns.length - totalAnalyzed },
              ] as const
            ).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilterTab(key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  filterTab === key
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    filterTab === key
                      ? "bg-white/20 text-white"
                      : "bg-background text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* Run cards */}
          <div className="max-h-[calc(100vh-320px)] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
            {runsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-20 rounded-lg" />
                ))}
              </div>
            ) : filteredRuns.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center">
                  <Terminal className="mx-auto h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {filterTab === "not_analyzed"
                      ? "All runs have been analyzed"
                      : "No completed runs yet"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredRuns.map((r) => {
                const art = getCodeAnalysisArtifact(r.artifacts ?? []);
                const hasAnalysis = Boolean(art);
                const payload = art?.json_payload as
                  | Record<string, unknown>
                  | undefined;
                const isValid = payload?.is_valid_issue === true;
                const hasPr =
                  payload?.pr_url != null &&
                  String(payload.pr_url).trim() !== "";
                const isSelected = activeRunId === r.id;
                const isRunAnalyzing = analyzingIds.has(r.id);

                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setExpandedRun(r.id);
                      if (runId) navigate(`/code-fix/${r.id}`, { replace: true });
                    }}
                    className={cn(
                      "group w-full rounded-lg border p-3 text-left transition-all duration-200",
                      isSelected
                        ? "border-indigo-400 bg-indigo-50/60 shadow-sm ring-1 ring-indigo-200"
                        : "border-border bg-card hover:border-indigo-200 hover:bg-indigo-50/30",
                      !hasAnalysis && "border-l-4 border-l-slate-300",
                      hasAnalysis && isValid && hasPr && "border-l-4 border-l-green-500",
                      hasAnalysis && isValid && !hasPr && "border-l-4 border-l-amber-500",
                      hasAnalysis && !isValid && "border-l-4 border-l-red-400"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">
                        {truncate(r.document_filename ?? shortId(r.id), 36)}
                      </p>
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform",
                          isSelected
                            ? "text-indigo-500"
                            : "text-muted-foreground/40 group-hover:text-muted-foreground"
                        )}
                      />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {r.jira && (
                        <span className="text-[11px] font-medium text-indigo-600">
                          {r.jira.jira_key}
                        </span>
                      )}
                      {hasAnalysis ? (
                        <>
                          <Badge
                            variant={isValid ? "success" : "destructive"}
                            className="h-5 px-1.5 text-[10px]"
                          >
                            {isValid ? "Valid" : "Invalid"}
                          </Badge>
                          {hasPr && (
                            <Badge
                              variant="info"
                              className="h-5 gap-0.5 px-1.5 text-[10px]"
                            >
                              <GitPullRequest className="h-2.5 w-2.5" />
                              PR
                            </Badge>
                          )}
                        </>
                      ) : isRunAnalyzing ? (
                        <Badge className="h-5 gap-1 bg-indigo-100 px-1.5 text-[10px] text-indigo-700 border-indigo-200">
                          <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                          Analyzing…
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          Not analyzed
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(r.created_at)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT — Detail panel */}
        <div className="min-h-[400px]">
          {!activeRun ? (
            <Card className="flex h-full items-center justify-center border-dashed">
              <CardContent className="py-20 text-center">
                <Sparkles className="mx-auto h-14 w-14 text-indigo-300" />
                <h3 className="mt-4 text-lg font-semibold text-muted-foreground">
                  Select a run to inspect
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick an issue from the list to view analysis or trigger {PAGE_TITLE}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="page-enter space-y-4" key={activeRunId}>
              {/* Run header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold tracking-tight">
                    {truncate(activeRun.document_filename ?? "Document", 52)}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {activeRun.jira && (
                      <a
                        href={activeRun.jira.jira_url ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
                      >
                        {activeRun.jira.jira_key}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <StatusBadge status={activeRun.status} />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isActiveRunAnalyzing}
                  onClick={() => triggerAnalysis(activeRun.id)}
                  className="shrink-0"
                >
                  <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isActiveRunAnalyzing && "animate-spin")} />
                  {isActiveRunAnalyzing ? "Running…" : codeArt ? "Re-run" : "Analyze"}
                </Button>
              </div>

              {/* No analysis yet */}
              {/* In-flight analysis for this specific run */}
              {!codeArt && isActiveRunAnalyzing && (
                <Card className="overflow-hidden border-2 border-indigo-300 bg-gradient-to-r from-indigo-50 via-white to-violet-50 shadow-lg">
                  <CardContent className="py-10">
                    <div className="flex flex-col items-center gap-5">
                      <div className="relative">
                        <div className="brain-pulse flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-xl shadow-indigo-200">
                          <Brain className="h-10 w-10 text-white" />
                        </div>
                        <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-green-400 glow-ring" />
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-lg font-semibold text-indigo-900">
                            {PAGE_TITLE} is thinking
                          </span>
                          <span className="flex gap-1">
                            <span className="thinking-dot h-2 w-2 rounded-full bg-indigo-500" />
                            <span className="thinking-dot h-2 w-2 rounded-full bg-indigo-500" />
                            <span className="thinking-dot h-2 w-2 rounded-full bg-indigo-500" />
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Scanning codebase, identifying root cause, generating fix &amp; PR…
                        </p>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-5 py-3">
                        {[
                          { icon: Search, label: "Scanning" },
                          { icon: Eye, label: "Analyzing" },
                          { icon: Code2, label: "Fixing" },
                          { icon: GitPullRequest, label: "PR" },
                        ].map((step, i) => (
                          <div key={step.label} className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100">
                                <step.icon className="h-3.5 w-3.5 text-indigo-600" />
                              </div>
                              <span className="text-xs font-medium text-indigo-700">{step.label}</span>
                            </div>
                            {i < 3 && <ChevronRight className="h-3.5 w-3.5 text-indigo-300" />}
                          </div>
                        ))}
                      </div>
                      <div className="h-1.5 w-64 overflow-hidden rounded-full bg-indigo-100">
                        <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-indigo-400 via-violet-500 to-indigo-400 shimmer-bar" />
                      </div>
                      <p className="text-xs text-muted-foreground">This may take a few minutes — results will appear automatically</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* No analysis yet — ready to trigger */}
              {!codeArt && !isActiveRunAnalyzing && (
                <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-50 to-indigo-50/50 shadow">
                  <CardContent className="flex flex-col items-center py-16">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg">
                      <Sparkles className="h-10 w-10 text-white" />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold">
                      Ready for Analysis
                    </h3>
                    <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
                      {PAGE_TITLE} will scan the codebase, identify the root cause,
                      and generate a fix PR automatically.
                    </p>
                    <Button
                      size="lg"
                      onClick={() => triggerAnalysis(activeRun.id)}
                      className="mt-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90"
                    >
                      <Zap className="mr-2 h-4 w-4" />
                      Run {PAGE_TITLE}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Analysis results */}
              {codeArt && codePayload && (
                <div className="space-y-4">
                  {/* Verdict + PR banner */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Verdict */}
                    <Card
                      className={cn(
                        "card-hover",
                        codePayload.is_valid_issue === true
                          ? "border-green-200 bg-green-50/50"
                          : "border-red-200 bg-red-50/50"
                      )}
                    >
                      <CardContent className="flex items-center gap-4 pt-6">
                        <div
                          className={cn(
                            "flex h-12 w-12 items-center justify-center rounded-xl",
                            codePayload.is_valid_issue === true
                              ? "bg-green-100"
                              : "bg-red-100"
                          )}
                        >
                          {codePayload.is_valid_issue === true ? (
                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                          ) : (
                            <XCircle className="h-6 w-6 text-red-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-lg font-bold">
                            {codePayload.is_valid_issue === true
                              ? "Valid Issue"
                              : "Not Valid"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Confidence: {Number(codePayload.confidence ?? 0).toFixed(0)}%
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* PR Status */}
                    <Card
                      className={cn(
                        "card-hover",
                        codePayload.pr_url
                          ? "border-indigo-200 bg-indigo-50/50"
                          : "border-dashed"
                      )}
                    >
                      <CardContent className="flex items-center gap-4 pt-6">
                        <div
                          className={cn(
                            "flex h-12 w-12 items-center justify-center rounded-xl",
                            codePayload.pr_url
                              ? "bg-indigo-100"
                              : "bg-muted"
                          )}
                        >
                          <GitPullRequest
                            className={cn(
                              "h-6 w-6",
                              codePayload.pr_url
                                ? "text-indigo-600"
                                : "text-muted-foreground/50"
                            )}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          {codePayload.pr_url ? (
                            <>
                              <p className="text-sm font-semibold text-indigo-700">
                                PR Generated
                              </p>
                              <a
                                href={String(codePayload.pr_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-0.5 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                              >
                                View Pull Request
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No PR generated
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Root Cause */}
                  {Boolean(codePayload.root_cause) &&
                    String(codePayload.root_cause).trim() !== "" && (
                      <Card className="card-hover border-l-4 border-l-indigo-500">
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-sm">
                            <FileText className="h-4 w-4 text-indigo-500" />
                            Root Cause
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {String(codePayload.root_cause)}
                          </p>
                        </CardContent>
                      </Card>
                    )}

                  {/* Fix Description */}
                  {Boolean(codePayload.fix_description) &&
                    String(codePayload.fix_description).trim() !== "" && (
                      <Card className="card-hover border-l-4 border-l-violet-500">
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-sm">
                            <Code2 className="h-4 w-4 text-violet-500" />
                            Proposed Fix
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {String(codePayload.fix_description)}
                          </p>
                        </CardContent>
                      </Card>
                    )}

                  {/* Affected Files */}
                  {Array.isArray(codePayload.affected_files) &&
                    (codePayload.affected_files as string[]).length > 0 && (
                      <Card className="card-hover">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">
                            Affected Files
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {(codePayload.affected_files as string[]).map(
                              (f, i) => (
                                <Badge
                                  key={i}
                                  variant="secondary"
                                  className={cn(
                                    "gap-1 font-mono text-xs",
                                    getFileIconClass(f)
                                  )}
                                >
                                  <FileCode2
                                    className={cn(
                                      "h-3 w-3",
                                      getFileIconClass(f)
                                    )}
                                  />
                                  {f}
                                </Badge>
                              )
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                  {/* Data Analysis (KB) */}
                  {dataAnalysis != null && typeof dataAnalysis === "object" && (
                    <Card
                      className={cn(
                        "card-hover",
                        dataAnalysis.is_data_specific
                          ? "border-amber-200 bg-amber-50/40"
                          : "border-emerald-200 bg-emerald-50/40"
                      )}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm">
                          {dataAnalysis.is_data_specific ? (
                            <>
                              <Database className="h-4 w-4 text-amber-600" />
                              Data-Specific Issue
                            </>
                          ) : (
                            <>
                              <Bug className="h-4 w-4 text-emerald-600" />
                              Systemic Bug
                            </>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge
                            variant={
                              dataAnalysis.is_data_specific
                                ? "warning"
                                : "success"
                            }
                            className="text-[11px]"
                          >
                            {dataAnalysis.is_data_specific
                              ? "Data-Specific"
                              : "Systemic"}
                          </Badge>
                          <Badge variant="secondary" className="text-[11px]">
                            Scope:{" "}
                            {String(
                              dataAnalysis.affected_scope ?? "unknown"
                            ).replace("_", " ")}
                          </Badge>
                        </div>
                        {Array.isArray(dataAnalysis.data_factors) &&
                          dataAnalysis.data_factors.length > 0 && (
                            <ul className="list-inside list-disc text-xs text-muted-foreground">
                              {(dataAnalysis.data_factors as string[]).map(
                                (f, i) => (
                                  <li key={i}>{f}</li>
                                )
                              )}
                            </ul>
                          )}
                        {Boolean(dataAnalysis.recommendation) && (
                          <p className="rounded bg-white/60 px-2 py-1 text-xs">
                            <span className="font-medium">Rec:</span>{" "}
                            {String(dataAnalysis.recommendation)}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
