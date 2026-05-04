import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  Upload,
  Sparkles,
  FileCheck,
  Tags,
  ExternalLink as JiraIcon,
  Wrench,
  UserCheck,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  GitPullRequest,
  FileCode2,
  Search,
  AlertTriangle,
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
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/layout/PageHeader";
import StepIndicator from "@/components/workflow/StepIndicator";
import StatusBadge from "@/components/workflow/StatusBadge";
import { useRuns, useRun, useAnalyzeCode } from "@/api/runs";
import { cn, formatDate, shortId, truncate } from "@/lib/utils";
import type { Artifact } from "@/api/client";

interface TimelineEvent {
  key: string;
  icon: typeof Upload;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  timestamp: string;
  details?: React.ReactNode;
  lineColor: string;
}

function buildTimeline(
  run: {
    id: string;
    created_at: string;
    status: string;
    document_filename?: string | null;
    jira?: { jira_key: string; jira_url: string | null } | null;
    artifacts: Artifact[];
  }
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const sorted = [...run.artifacts].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  events.push({
    key: "upload",
    icon: Upload,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-100",
    title: "Document Uploaded",
    description: run.document_filename ?? "Document uploaded to the system",
    timestamp: run.created_at,
    lineColor: "bg-blue-300",
  });

  const agent1 = sorted.find((a) => a.stage === "agent1_output");
  if (agent1) {
    const p = agent1.json_payload as Record<string, unknown>;
    events.push({
      key: "agent1",
      icon: Sparkles,
      iconColor: "text-violet-600",
      iconBg: "bg-violet-100",
      title: "AI Extraction Complete",
      description: `Agent-1 extracted fields with ${p.confidence ?? "N/A"}% confidence`,
      timestamp: agent1.created_at,
      details: p.title ? (
        <p className="mt-1 text-xs text-muted-foreground">Title: {truncate(String(p.title), 80)}</p>
      ) : null,
      lineColor: "bg-violet-300",
    });
  }

  const verified = sorted.find((a) => a.stage === "verified_v1");
  if (verified) {
    events.push({
      key: "gtm_review",
      icon: FileCheck,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-100",
      title: "GTM Review Approved",
      description: `Verified by ${verified.created_by ?? "GTM"}`,
      timestamp: verified.created_at,
      lineColor: "bg-amber-300",
    });
  }

  const agent2 = sorted.find((a) => a.stage === "agent2_output");
  if (agent2) {
    const p = agent2.json_payload as Record<string, unknown>;
    events.push({
      key: "agent2",
      icon: Tags,
      iconColor: "text-purple-600",
      iconBg: "bg-purple-100",
      title: "Classification & Prioritization",
      description: `${String(p.classification ?? "").replace("_", " ")} · ${String(p.priority ?? "").toUpperCase()} · Score: ${Number(p.priority_score ?? 0).toFixed(1)}`,
      timestamp: agent2.created_at,
      details: p.module ? (
        <Badge variant="secondary" className="mt-1 text-xs">{String(p.module)}</Badge>
      ) : null,
      lineColor: "bg-purple-300",
    });
  }

  const pmVerified = sorted.find((a) => a.stage === "pm_verified");
  if (pmVerified) {
    events.push({
      key: "pm_review",
      icon: FileCheck,
      iconColor: "text-purple-600",
      iconBg: "bg-purple-100",
      title: "PM Review Approved",
      description: `Classified and approved by ${pmVerified.created_by ?? "PM"}`,
      timestamp: pmVerified.created_at,
      lineColor: "bg-purple-300",
    });
  }

  const jiraPayload = sorted.find((a) => a.stage === "jira_payload");
  if (run.jira) {
    events.push({
      key: "jira",
      icon: JiraIcon,
      iconColor: "text-orange-600",
      iconBg: "bg-orange-100",
      title: `JIRA Ticket Created — ${run.jira.jira_key}`,
      description: "Ticket auto-created in JIRA board",
      timestamp: jiraPayload?.created_at ?? run.created_at,
      details: (
        <a
          href={run.jira.jira_url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
        >
          {run.jira.jira_key} <ExternalLink className="h-3 w-3" />
        </a>
      ),
      lineColor: "bg-orange-300",
    });
  }

  const codeAnalysis = sorted.find((a) => a.stage === "code_analysis");
  if (codeAnalysis) {
    const p = codeAnalysis.json_payload as Record<string, unknown>;
    const isValid = p.is_valid_issue === true;
    const hasPr = Boolean(p.pr_url) && String(p.pr_url).trim() !== "";
    const affectedFiles = Array.isArray(p.affected_files) ? (p.affected_files as string[]) : [];

    events.push({
      key: "code_analysis",
      icon: Wrench,
      iconColor: isValid ? "text-emerald-600" : "text-red-600",
      iconBg: isValid ? "bg-emerald-100" : "bg-red-100",
      title: isValid ? "AutoResolve — Valid Issue Found" : "AutoResolve — Not Valid",
      description: isValid
        ? truncate(String(p.root_cause ?? "Root cause identified"), 100)
        : "Agent-3 determined this is not a valid code issue",
      timestamp: codeAnalysis.created_at,
      details: (
        <div className="mt-2 space-y-2">
          {affectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {affectedFiles.slice(0, 5).map((f, i) => (
                <Badge key={i} variant="secondary" className="gap-1 font-mono text-[10px]">
                  <FileCode2 className="h-2.5 w-2.5" /> {f}
                </Badge>
              ))}
              {affectedFiles.length > 5 && (
                <Badge variant="secondary" className="text-[10px]">+{affectedFiles.length - 5} more</Badge>
              )}
            </div>
          )}
          {hasPr && (
            <a
              href={String(p.pr_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
            >
              <GitPullRequest className="h-3 w-3" /> View Pull Request
            </a>
          )}
          {Boolean(p.fix_description) && (
            <p className="text-[11px] text-muted-foreground">
              Fix: {truncate(String(p.fix_description), 120)}
            </p>
          )}
        </div>
      ),
      lineColor: isValid ? "bg-emerald-300" : "bg-red-300",
    });
  }

  const engReview = sorted.find((a) => a.stage === "eng_review");
  if (engReview) {
    const p = engReview.json_payload as Record<string, unknown>;
    const approved = p.status === "approved";
    events.push({
      key: "eng_review",
      icon: UserCheck,
      iconColor: approved ? "text-teal-600" : "text-amber-600",
      iconBg: approved ? "bg-teal-100" : "bg-amber-100",
      title: `Engineer Review — ${approved ? "Approved" : p.status === "rejected" ? "Rejected" : "Changes Requested"}`,
      description: `Reviewed by ${String(p.reviewer ?? "Engineer")}`,
      timestamp: engReview.created_at,
      details: Boolean(p.comments) ? (
        <p className="mt-1 text-xs text-muted-foreground italic">"{String(p.comments)}"</p>
      ) : null,
      lineColor: approved ? "bg-teal-300" : "bg-amber-300",
    });
  }

  const emSignoff = sorted.find((a) => a.stage === "em_signoff");
  if (emSignoff) {
    const p = emSignoff.json_payload as Record<string, unknown>;
    events.push({
      key: "em_signoff",
      icon: ShieldCheck,
      iconColor: "text-cyan-600",
      iconBg: "bg-cyan-100",
      title: "EM Sign-off — Approved",
      description: `Signed off by ${String(p.manager ?? "EM")}`,
      timestamp: emSignoff.created_at,
      details: Boolean(p.comments) ? (
        <p className="mt-1 text-xs text-muted-foreground italic">"{String(p.comments)}"</p>
      ) : null,
      lineColor: "bg-cyan-300",
    });
  }

  if (run.status === "done") {
    events.push({
      key: "resolved",
      icon: CheckCircle2,
      iconColor: "text-green-600",
      iconBg: "bg-green-100",
      title: "Issue Resolved",
      description: "All approvals complete — issue is marked resolved",
      timestamp: emSignoff?.created_at ?? run.created_at,
      lineColor: "bg-green-400",
    });
  }

  if (run.status === "failed") {
    events.push({
      key: "failed",
      icon: XCircle,
      iconColor: "text-red-600",
      iconBg: "bg-red-100",
      title: "Run Failed",
      description: "An error occurred during processing",
      timestamp: run.created_at,
      lineColor: "bg-red-400",
    });
  }

  return events;
}

export default function RunTimeline() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: runs = [], isLoading: runsLoading } = useRuns();
  const { data: run, isLoading: runLoading } = useRun(runId);
  const analyzeCode = useAnalyzeCode();

  const filteredRuns = search.trim()
    ? runs.filter((r) =>
        (r.document_filename ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (r.jira?.jira_key ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : runs;

  const sortedRuns = [...filteredRuns].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (!runId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Activity Log" description="Full lifecycle of every workflow run" />
        <div className="flex gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by filename or JIRA key..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Card className="card-hover">
          <CardContent className="p-0">
            {runsLoading ? (
              <div className="space-y-3 p-6">
                {[1, 2, 3].map((i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
              </div>
            ) : sortedRuns.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No runs found</p>
            ) : (
              <div className="stagger-enter overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Document</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">JIRA</th>
                      <th className="px-4 py-3 text-left font-medium">PR</th>
                      <th className="px-4 py-3 text-left font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRuns.map((r, i) => {
                      const codeArt = r.artifacts.find((a) => a.stage === "code_analysis");
                      const codePl = codeArt?.json_payload as Record<string, unknown> | undefined;
                      const prUrl = codePl?.pr_url ? String(codePl.pr_url) : null;

                      return (
                        <tr
                          key={r.id}
                          onClick={() => navigate(`/timeline/${r.id}`)}
                          className={cn(
                            "row-hover cursor-pointer border-b transition-colors last:border-0",
                            i % 2 === 1 && "bg-muted/20"
                          )}
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium">{truncate(r.document_filename ?? shortId(r.id), 36)}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">{shortId(r.id)}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                          <td className="px-4 py-3">
                            {r.jira ? (
                              <a
                                href={r.jira.jira_url ?? "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-cb-blue hover:underline"
                              >
                                {r.jira.jira_key} <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {prUrl ? (
                              <a
                                href={prUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                              >
                                <GitPullRequest className="h-3 w-3" /> PR
                              </a>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(r.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (runLoading || !run) {
    return (
      <div className="space-y-6">
        <PageHeader title="Activity Log" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const timeline = buildTimeline(run);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/timeline" className="inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Activity Log
        </Link>
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {truncate(run.document_filename ?? "Document", 52)}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono text-xs">{shortId(run.id)}</span>
            {run.jira && (
              <a
                href={run.jira.jira_url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
              >
                {run.jira.jira_key} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        <StepIndicator currentStep={run.current_step} status={run.status} />
      </div>

      {/* Visual Activity Timeline */}
      <Card className="card-hover">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Activity Timeline
          </CardTitle>
          <CardDescription>
            Complete lifecycle from upload to resolution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {timeline.map((event, i) => {
              const Icon = event.icon;
              const isLast = i === timeline.length - 1;

              return (
                <div key={event.key} className="relative flex gap-4 pb-8 last:pb-0">
                  {/* Vertical line */}
                  {!isLast && (
                    <div
                      className={cn(
                        "absolute left-[19px] top-10 h-[calc(100%-32px)] w-0.5",
                        event.lineColor
                      )}
                    />
                  )}

                  {/* Icon circle */}
                  <div
                    className={cn(
                      "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                      event.iconBg
                    )}
                  >
                    <Icon className={cn("h-5 w-5", event.iconColor)} />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold">{event.title}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatDate(event.timestamp)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{event.description}</p>
                    {event.details}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Trigger AutoResolve if applicable */}
      {run.status === "awaiting_code_fix" && !run.artifacts.some((a) => a.stage === "code_analysis") && (
        <Card className="card-hover border-indigo-200 bg-indigo-50/30">
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="font-medium">Ready for AutoResolve</p>
              <p className="text-sm text-muted-foreground">Trigger code analysis to identify root cause and generate a fix</p>
            </div>
            <Button
              onClick={() => analyzeCode.mutate(run.id)}
              disabled={analyzeCode.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {analyzeCode.isPending ? "Running…" : "Run AutoResolve"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
