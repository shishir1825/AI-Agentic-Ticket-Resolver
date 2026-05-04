import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  Lock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  GitPullRequest,
  FileCode2,
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/workflow/StatusBadge";
import { useRuns, useRun, useEngineerReview } from "@/api/runs";
import { type Role } from "@/lib/constants";
import { cn, formatDate, truncate } from "@/lib/utils";

function getCodeAnalysisArtifact(
  artifacts: { stage: string; json_payload: Record<string, unknown> }[]
) {
  return artifacts.find((a) => a.stage === "code_analysis");
}

function getEngReviewArtifact(
  artifacts: { stage: string; json_payload: Record<string, unknown> }[]
) {
  return artifacts.find((a) => a.stage === "eng_review");
}

interface EngineerReviewProps {
  role: Role;
}

export default function EngineerReview({ role }: EngineerReviewProps) {
  const { runId } = useParams<{ runId: string }>();
  const { data: runs = [], isLoading: runsLoading } = useRuns();
  const { data: run, isLoading: runLoading } = useRun(runId);
  const engineerReview = useEngineerReview();

  const [status, setStatus] = useState<"approved" | "request_changes" | "rejected">("approved");
  const [comments, setComments] = useState("");
  const [reviewer, setReviewer] = useState("");

  const canAccess = role === "engineering" || role === "admin";

  if (!canAccess) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Engineer Review"
          description="Review AI-generated code fixes and PRs before they're merged"
        />
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="flex items-center gap-4 pt-6">
            <Lock className="h-10 w-10 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-900">Access Restricted</p>
              <p className="text-sm text-amber-800">
                Engineer Review is available to Engineering and Admin roles.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!runId) {
    const reviewableRuns = runs.filter((r) =>
      ["awaiting_eng_review", "awaiting_em_signoff", "done"].includes(r.status) &&
      r.artifacts.some((a) => a.stage === "code_analysis")
    );

    const pending = reviewableRuns.filter((r) => r.status === "awaiting_eng_review");
    const reviewed = reviewableRuns.filter((r) =>
      r.artifacts.some((a) => a.stage === "eng_review")
    );

    return (
      <div className="space-y-6">
        <PageHeader
          title="Engineer Review"
          description="Review AI-generated code fixes and PRs before they're merged"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="card-hover">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-100 p-2">
                  <MessageSquare className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold count-up">{pending.length}</p>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-100 p-2">
                  <CheckCircle2 className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold count-up">{reviewed.length}</p>
                  <p className="text-sm text-muted-foreground">Reviewed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-100 p-2">
                  <GitPullRequest className="h-5 w-5 text-indigo-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold count-up">{reviewableRuns.length}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Inbox</CardTitle>
            <CardDescription>
              Runs with code analysis — review fixes and PRs before merge
            </CardDescription>
          </CardHeader>
          <CardContent>
            {runsLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : reviewableRuns.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground/30" />
                <p className="mt-3 text-sm text-muted-foreground">No runs awaiting review</p>
              </div>
            ) : (
              <div className="stagger-enter space-y-3">
                {reviewableRuns.map((r) => {
                  const codeArt = getCodeAnalysisArtifact(r.artifacts);
                  const payload = codeArt?.json_payload as Record<string, unknown> | undefined;
                  const isValid = payload?.is_valid_issue === true;
                  const prUrl = payload?.pr_url ? String(payload.pr_url) : null;
                  const engArt = getEngReviewArtifact(r.artifacts);
                  const engPayload = engArt?.json_payload as Record<string, unknown> | undefined;
                  const isPending = r.status === "awaiting_eng_review";

                  return (
                    <Card
                      key={r.id}
                      className={cn(
                        "card-hover flex items-center justify-between p-4",
                        isPending && "border-l-4 border-l-amber-400"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {truncate(r.document_filename ?? r.id, 48)}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <StatusBadge status={r.status} />
                          {r.jira && (
                            <a
                              href={r.jira.jira_url ?? "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-cb-blue hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {r.jira.jira_key}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          <Badge
                            variant={isValid ? "success" : "destructive"}
                            className="text-xs"
                          >
                            {isValid ? "Valid issue" : "Invalid issue"}
                          </Badge>
                          {prUrl && (
                            <a
                              href={prUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-cb-blue hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <GitPullRequest className="h-3 w-3" />
                              PR
                            </a>
                          )}
                          {engPayload && (
                            <Badge
                              className={cn(
                                "text-xs",
                                engPayload.status === "approved" && "bg-green-100 text-green-800",
                                engPayload.status === "rejected" && "bg-red-100 text-red-800",
                                engPayload.status === "request_changes" && "bg-amber-100 text-amber-800"
                              )}
                            >
                              {engPayload.status === "approved" ? "Approved" :
                               engPayload.status === "rejected" ? "Rejected" : "Changes Requested"}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button size="sm" asChild>
                        <Link to={`/engineer-review/${r.id}`}>
                          {isPending ? "Review" : "View"}
                        </Link>
                      </Button>
                    </Card>
                  );
                })}
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
        <PageHeader title="Engineer Review" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const codeAnalysisArtifact = getCodeAnalysisArtifact(run.artifacts);
  const codePayload = codeAnalysisArtifact?.json_payload as Record<string, unknown> | undefined;
  const engReviewArtifact = getEngReviewArtifact(run.artifacts);
  const engReviewPayload = engReviewArtifact?.json_payload as Record<string, unknown> | undefined;
  const canReview = run.status === "awaiting_eng_review";

  if (!codeAnalysisArtifact || !codePayload) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/engineer-review" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No code analysis found.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Code analysis must be run first from the AutoResolve page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmitReview = () => {
    if (!reviewer.trim()) return;
    engineerReview.mutate({
      runId: run.id,
      status,
      reviewer: reviewer.trim(),
      comments: comments || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/engineer-review" className="inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Inbox
        </Link>
      </Button>

      <PageHeader
        title="Engineer Review"
        description={`${truncate(run.document_filename ?? "Document", 48)}${
          run.jira ? ` · ${run.jira.jira_key}` : ""
        }`}
      />

      <div className="space-y-4">
        {Boolean(codePayload.root_cause) &&
          String(codePayload.root_cause).trim() !== "" && (
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="text-base">Root Cause</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border bg-muted/30 px-4 py-3">
                  <p className="whitespace-pre-wrap text-sm">
                    {String(codePayload.root_cause)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

        {Array.isArray(codePayload.affected_files) &&
          (codePayload.affected_files as string[]).length > 0 && (
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="text-base">Affected Files</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(codePayload.affected_files as string[]).map((f, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 font-mono text-xs">
                      <FileCode2 className="h-3 w-3" />
                      {f}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        {Boolean(codePayload.fix_description) &&
          String(codePayload.fix_description).trim() !== "" && (
            <Card className="card-hover">
              <CardHeader>
                <CardTitle className="text-base">Proposed Fix</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">
                  {String(codePayload.fix_description)}
                </p>
              </CardContent>
            </Card>
          )}

        {Boolean(codePayload.pr_url) && String(codePayload.pr_url).trim() !== "" && (
          <Card className="card-hover border-indigo-200 bg-indigo-50/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-indigo-700">
                <GitPullRequest className="h-5 w-5" />
                Pull Request
              </CardTitle>
            </CardHeader>
            <CardContent>
              <a
                href={String(codePayload.pr_url)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="bg-indigo-600 hover:bg-indigo-700">
                  View Pull Request
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </a>
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      {engReviewPayload ? (
        <Card
          className={cn(
            "card-hover scale-pop",
            engReviewPayload.status === "approved" && "border-green-200 bg-green-50/50",
            engReviewPayload.status === "request_changes" && "border-amber-200 bg-amber-50/50",
            engReviewPayload.status === "rejected" && "border-red-200 bg-red-50/50"
          )}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {engReviewPayload.status === "approved" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
              {engReviewPayload.status === "request_changes" && <MessageSquare className="h-5 w-5 text-amber-600" />}
              {engReviewPayload.status === "rejected" && <XCircle className="h-5 w-5 text-red-600" />}
              Review Submitted
            </CardTitle>
            <CardDescription>
              {engReviewPayload.status === "approved" ? "Approved" :
               engReviewPayload.status === "request_changes" ? "Changes Requested" : "Rejected"}
              {Boolean(engReviewPayload.reviewer) && ` by ${String(engReviewPayload.reviewer)}`}
            </CardDescription>
          </CardHeader>
          {Boolean(engReviewPayload.comments) && (
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{String(engReviewPayload.comments)}</p>
            </CardContent>
          )}
        </Card>
      ) : canReview ? (
        <Card>
          <CardHeader>
            <CardTitle>Submit Review</CardTitle>
            <CardDescription>Approve, request changes, or reject this fix</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium">Decision</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {([
                  { value: "approved" as const, label: "Approve", icon: CheckCircle2, activeClass: "border-green-500 bg-green-50", iconClass: "text-green-600" },
                  { value: "request_changes" as const, label: "Request Changes", icon: MessageSquare, activeClass: "border-amber-500 bg-amber-50", iconClass: "text-amber-600" },
                  { value: "rejected" as const, label: "Reject", icon: XCircle, activeClass: "border-red-500 bg-red-50", iconClass: "text-red-600" },
                ]).map(({ value, label, icon: Icon, activeClass, iconClass }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatus(value)}
                    className={cn(
                      "card-hover flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors",
                      status === value ? activeClass : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <Icon className={cn("h-6 w-6", status === value ? iconClass : "text-muted-foreground")} />
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Reviewer Name</label>
              <Input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Your name" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Comments (optional)</label>
              <Textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Review notes..." rows={4} />
            </div>

            <Button onClick={handleSubmitReview} disabled={!reviewer.trim() || engineerReview.isPending}>
              {engineerReview.isPending ? "Submitting…" : "Submit Review"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            This run is not currently awaiting engineer review.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
