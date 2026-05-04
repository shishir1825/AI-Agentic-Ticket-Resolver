import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FileText,
  ClipboardList,
  CheckCircle2,
  ExternalLink,
  Search,
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
import { useRuns, useRun, useApprovePM, useRejectPM } from "@/api/runs";
import {
  CLASSIFICATION_CONFIG,
  MODULES,
  MODULE_CONFIG,
  PRIORITY_CONFIG,
  type Role,
} from "@/lib/constants";
import { SkeletonCard } from "@/components/ui/skeleton";
import { cn, formatDate, truncate } from "@/lib/utils";

interface Agent1Payload {
  problem_statement?: string;
  module?: string;
}

interface Agent2Payload {
  classification?: string;
  module?: string;
  priority?: string;
  priority_score?: number;
  score_breakdown?: {
    arr?: number;
    escalation?: number;
    strategic?: number;
    severity?: number;
    affected_customers?: number;
  };
  owner_team_suggestion?: string;
  rationale?: string;
  assumptions?: string[];
}

function getAgent1Output(artifacts: { stage: string; version: number; json_payload: Record<string, unknown> }[]) {
  const verified = artifacts
    .filter((a) => a.stage === "verified_v1" || a.stage === "agent1_output")
    .sort((a, b) => {
      if (a.stage === "verified_v1" && b.stage !== "verified_v1") return -1;
      if (a.stage !== "verified_v1" && b.stage === "verified_v1") return 1;
      return b.version - a.version;
    });
  return verified[0]?.json_payload as Agent1Payload | undefined;
}

function getAgent2Output(artifacts: { stage: string; json_payload: Record<string, unknown> }[]) {
  return artifacts.find((a) => a.stage === "agent2_output")
    ?.json_payload as Agent2Payload | undefined;
}

interface PMReviewProps {
  role: Role;
}

export default function PMReview({ role }: PMReviewProps) {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [approverName, setApproverName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [moduleOverride, setModuleOverride] = useState<string | null>(null);

  useEffect(() => {
    setModuleOverride(null);
  }, [runId]);

  const { data: runs = [], isLoading: runsLoading } = useRuns();
  const { data: run, isLoading: runLoading } = useRun(runId);
  const approvePM = useApprovePM();
  const rejectPM = useRejectPM();

  const awaitingPm = runs.filter((r) => r.status === "awaiting_pm");

  const PRE_PM_STATUSES = new Set([
    "processing", "uploaded", "running_agent1",
    "awaiting_uploader", "running_agent2", "awaiting_pm",
  ]);
  const postPmRuns = runs.filter((r) => !PRE_PM_STATUSES.has(r.status) && r.status !== "failed");
  const inPipelineRuns = postPmRuns.filter((r) => r.status !== "done");
  const doneRuns = postPmRuns.filter((r) => r.status === "done");
  const completedRuns = [...inPipelineRuns, ...doneRuns];

  // No runId: inbox view
  if (!runId) {
    const filteredCompleted = searchQuery.trim()
      ? completedRuns.filter((r) =>
          (r.document_filename ?? "").toLowerCase().includes(searchQuery.toLowerCase())
        )
      : completedRuns;

    return (
      <div className="space-y-6">
        <PageHeader
          title="PM Review"
          description="Review and approve extractions for JIRA creation"
        />

        {/* Stats strip */}
        <div className="stagger-enter grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-100 p-2">
                  <ClipboardList className="h-5 w-5 text-purple-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold count-up">{awaitingPm.length}</p>
                  <p className="text-sm text-muted-foreground">
                    Awaiting Review
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-orange-100 p-2">
                  <FileText className="h-5 w-5 text-orange-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold count-up">{inPipelineRuns.length}</p>
                  <p className="text-sm text-muted-foreground">
                    In Pipeline
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-cb-success/20 p-2">
                  <CheckCircle2 className="h-5 w-5 text-cb-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold count-up">{doneRuns.length}</p>
                  <p className="text-sm text-muted-foreground">Resolved</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Inbox queue */}
        <Card>
          <CardHeader>
            <CardTitle>Inbox</CardTitle>
            <CardDescription>
              Runs awaiting PM review — click Review to open
            </CardDescription>
          </CardHeader>
          <CardContent>
            {runsLoading ? (
              <div className="space-y-3">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : awaitingPm.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No runs awaiting review
              </p>
            ) : (
              <div className="space-y-3">
                {awaitingPm.map((r) => {
                  const a1 = getAgent1Output(r.artifacts);
                  const a2 = getAgent2Output(r.artifacts);
                  const classification = a2?.classification ?? "unknown";
                  const priority = a2?.priority ?? "low";
                  const module = a2?.module ?? a1?.module;
                  const team = a2?.owner_team_suggestion ?? "—";
                  return (
                    <Card key={r.id} className="card-hover flex items-center justify-between p-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {truncate(r.document_filename ?? r.id, 40)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge
                            className={cn(
                              CLASSIFICATION_CONFIG[classification]?.bg,
                              CLASSIFICATION_CONFIG[classification]?.color
                            )}
                          >
                            {CLASSIFICATION_CONFIG[classification]?.label ??
                              classification}
                          </Badge>
                          <Badge
                            className={cn(
                              PRIORITY_CONFIG[priority]?.bg,
                              PRIORITY_CONFIG[priority]?.color
                            )}
                          >
                            {PRIORITY_CONFIG[priority]?.label ?? priority}
                          </Badge>
                          {module && (
                            <Badge
                              className={cn(
                                MODULE_CONFIG[module as keyof typeof MODULE_CONFIG]?.bg,
                                MODULE_CONFIG[module as keyof typeof MODULE_CONFIG]?.color
                              )}
                            >
                              {MODULE_CONFIG[module as keyof typeof MODULE_CONFIG]?.label ?? module}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {team}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(r.created_at)}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => navigate(`/pm-review/${r.id}`)}
                      >
                        Review
                      </Button>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed section */}
        <Card>
          <CardHeader>
            <CardTitle>PM Reviewed</CardTitle>
            <CardDescription>
              All runs that have passed PM review
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by filename..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            {filteredCompleted.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {searchQuery.trim()
                  ? "No matching runs"
                  : "No completed runs yet"}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Doc</th>
                      <th className="px-4 py-3 text-left font-medium">
                        Classification
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        Priority
                      </th>
                      <th className="px-4 py-3 text-left font-medium">Module</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">
                        JIRA Key
                      </th>
                      <th className="px-4 py-3 text-left font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompleted.map((r) => {
                      const a1 = getAgent1Output(r.artifacts);
                      const a2 = getAgent2Output(r.artifacts);
                      const priority = a2?.priority ?? "low";
                      const module = a2?.module ?? a1?.module;
                      const rowBg =
                        priority === "high"
                          ? "bg-orange-50"
                          : priority === "medium"
                            ? "bg-amber-50"
                            : "bg-gray-50";
                      return (
                        <tr
                          key={r.id}
                          className={cn(
                            "border-b last:border-0 row-hover cursor-pointer",
                            rowBg
                          )}
                          onClick={() => navigate(`/pm-review/${r.id}`)}
                        >
                          <td className="px-4 py-3">
                            {truncate(r.document_filename ?? r.id, 24)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              className={cn(
                                CLASSIFICATION_CONFIG[a2?.classification ?? "unknown"]?.bg,
                                CLASSIFICATION_CONFIG[a2?.classification ?? "unknown"]?.color
                              )}
                            >
                              {CLASSIFICATION_CONFIG[a2?.classification ?? "unknown"]
                                ?.label ?? "—"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              className={cn(
                                PRIORITY_CONFIG[priority]?.bg,
                                PRIORITY_CONFIG[priority]?.color
                              )}
                            >
                              {PRIORITY_CONFIG[priority]?.label ?? "—"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {module ? (
                              <Badge
                                className={cn(
                                  MODULE_CONFIG[module as keyof typeof MODULE_CONFIG]?.bg,
                                  MODULE_CONFIG[module as keyof typeof MODULE_CONFIG]?.color
                                )}
                              >
                                {MODULE_CONFIG[module as keyof typeof MODULE_CONFIG]?.label ?? module}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="px-4 py-3">
                            {r.jira ? (
                              <a
                                href={r.jira.jira_url ?? "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-cb-blue hover:underline"
                              >
                                {r.jira.jira_key}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(r.created_at)}
                          </td>
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

  // runId: detail view
  if (runLoading || !run) {
    return (
      <div className="space-y-6">
        <PageHeader title="PM Review" />
        <p className="text-sm text-muted-foreground">Loading run…</p>
      </div>
    );
  }

  const agent1 = getAgent1Output(run.artifacts);
  const agent2 = getAgent2Output(run.artifacts);
  const canApprove = run.status === "awaiting_pm" && (role === "pm" || role === "admin");
  const scoreBreakdown = agent2?.score_breakdown ?? {};
  const scoreKeys = [
    "arr",
    "escalation",
    "strategic",
    "severity",
    "affected_customers",
  ] as const;

  const handleApprove = () => {
    if (!approverName.trim()) return;
    approvePM.mutate(
      {
        runId: run.id,
        approvedBy: approverName.trim(),
        overrides:
          moduleOverride != null ? { module: moduleOverride } : undefined,
      },
      {
        onSuccess: () => navigate("/pm-review"),
      }
    );
  };

  const handleReject = () => {
    if (!approverName.trim()) return;
    rejectPM.mutate(
      {
        runId: run.id,
        approvedBy: approverName.trim(),
        comments: "Sent back to GTM for re-review",
      },
      {
        onSuccess: () => navigate("/pm-review"),
      }
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="PM Review"
        description={`Reviewing: ${truncate(run.document_filename ?? run.id, 48)}`}
      />

      <StepIndicator currentStep={run.current_step} status={run.status} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Problem Statement</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">
            {agent1?.problem_statement ?? "—"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Classification & Priority</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge
              className={cn(
                CLASSIFICATION_CONFIG[agent2?.classification ?? "unknown"]?.bg,
                CLASSIFICATION_CONFIG[agent2?.classification ?? "unknown"]?.color
              )}
            >
              {CLASSIFICATION_CONFIG[agent2?.classification ?? "unknown"]
                ?.label ?? "—"}
            </Badge>
            <Badge
              className={cn(
                PRIORITY_CONFIG[agent2?.priority ?? "low"]?.bg,
                PRIORITY_CONFIG[agent2?.priority ?? "low"]?.color
              )}
            >
              {PRIORITY_CONFIG[agent2?.priority ?? "low"]?.label ?? "—"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Team: {agent2?.owner_team_suggestion ?? "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Module</CardTitle>
          <CardDescription>
            Assigned by AI agents — you can override below
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {(() => {
              const effectiveModule = moduleOverride ?? agent2?.module ?? agent1?.module;
              const cfg = MODULE_CONFIG[effectiveModule as keyof typeof MODULE_CONFIG];
              return (
                <Badge className={cn(cfg?.bg, cfg?.color, "text-sm px-3 py-1")}>
                  {cfg?.label ?? effectiveModule ?? "—"}
                </Badge>
              );
            })()}
            {agent2?.module && agent1?.module && agent2.module !== agent1.module && !moduleOverride && (
              <span className="text-xs text-muted-foreground">
                Agent-1: {agent1.module} → Agent-2 refined to: {agent2.module}
              </span>
            )}
          </div>
          {canApprove && (
            <div>
              <label className="mb-1 block text-sm font-medium">
                Override Module
              </label>
              <select
                value={moduleOverride ?? agent2?.module ?? agent1?.module ?? ""}
                onChange={(e) => setModuleOverride(e.target.value || null)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              >
                <option value="">— Keep AI assignment —</option>
                {MODULES.map((m) => (
                  <option key={m} value={m}>
                    {MODULE_CONFIG[m].label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Score breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Score Breakdown</CardTitle>
          <CardDescription>Each metric out of 10</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {scoreKeys.map((key) => {
            const val = scoreBreakdown[key] ?? 0;
            const label =
              key === "arr"
                ? "ARR"
                : key === "affected_customers"
                  ? "Affected Customers"
                  : key.charAt(0).toUpperCase() + key.slice(1);
            return (
              <div key={key}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{label}</span>
                  <span>{val}/10</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cb-blue to-cb-success transition-all duration-700 ease-out"
                    style={{ width: `${(val / 10) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {agent2?.rationale && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rationale</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{agent2.rationale}</p>
          </CardContent>
        </Card>
      )}

      {canApprove && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approve</CardTitle>
            <CardDescription>
              Approve this run to create a JIRA ticket
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Your Name
              </label>
              <Input
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleApprove}
                disabled={!approverName.trim() || approvePM.isPending || rejectPM.isPending}
              >
                {approvePM.isPending ? "Creating…" : "Approve & Create JIRA"}
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!approverName.trim() || approvePM.isPending || rejectPM.isPending}
              >
                {rejectPM.isPending ? "Sending back…" : "Send Back to GTM"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {run.status === "done" && run.jira && (
        <Card className="border-cb-success/30 bg-cb-success/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-cb-success">
              <CheckCircle2 className="h-5 w-5" />
              JIRA Created
            </CardTitle>
            <CardDescription>{run.jira.jira_key}</CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href={run.jira.jira_url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-cb-blue hover:underline"
            >
              Open in JIRA
              <ExternalLink className="h-4 w-4" />
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
