import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  Lock,
  CheckCircle2,
  FileSignature,
  GitPullRequest,
  FileCode2,
  ShieldCheck,
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
import { useRuns, useRun, useEMSignoff } from "@/api/runs";
import { type Role } from "@/lib/constants";
import { cn, formatDate, truncate } from "@/lib/utils";

function getArtifact(artifacts: { stage: string; json_payload: Record<string, unknown> }[], stage: string) {
  return artifacts.find((a) => a.stage === stage);
}

interface EMSignoffProps {
  role: Role;
}

export default function EMSignoff({ role }: EMSignoffProps) {
  const { runId } = useParams<{ runId: string }>();
  const { data: runs = [], isLoading: runsLoading } = useRuns();
  const { data: run, isLoading: runLoading } = useRun(runId);
  const emSignoff = useEMSignoff();

  const [manager, setManager] = useState("");
  const [comments, setComments] = useState("");

  const canAccess = role === "engineering" || role === "admin";

  if (!canAccess) {
    return (
      <div className="space-y-6">
        <PageHeader title="EM Sign-off" description="Final engineering manager approval before fixes go live" />
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="flex items-center gap-4 pt-6">
            <Lock className="h-10 w-10 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-900">Access Restricted</p>
              <p className="text-sm text-amber-800">EM Sign-off is available to Engineering and Admin roles.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!runId) {
    const eligibleRuns = runs.filter((r) =>
      ["awaiting_em_signoff", "done"].includes(r.status) &&
      r.artifacts.some((a) => a.stage === "eng_review")
    );

    const awaiting = eligibleRuns.filter((r) => r.status === "awaiting_em_signoff");
    const signedOff = eligibleRuns.filter((r) =>
      r.artifacts.some((a) => a.stage === "em_signoff")
    );

    return (
      <div className="space-y-6">
        <PageHeader title="EM Sign-off" description="Final engineering manager approval before fixes go live" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="card-hover">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-100 p-2">
                  <FileSignature className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold count-up">{awaiting.length}</p>
                  <p className="text-sm text-muted-foreground">Awaiting Sign-off</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-100 p-2">
                  <ShieldCheck className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold count-up">{signedOff.length}</p>
                  <p className="text-sm text-muted-foreground">Signed Off</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ready for Sign-off</CardTitle>
            <CardDescription>Runs with approved engineer review — final EM approval required</CardDescription>
          </CardHeader>
          <CardContent>
            {runsLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : eligibleRuns.length === 0 ? (
              <div className="py-12 text-center">
                <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground/30" />
                <p className="mt-3 text-sm text-muted-foreground">No runs pending sign-off</p>
              </div>
            ) : (
              <div className="stagger-enter space-y-3">
                {eligibleRuns.map((r) => {
                  const engArt = getArtifact(r.artifacts, "eng_review");
                  const engPayload = engArt?.json_payload as Record<string, unknown> | undefined;
                  const emArt = getArtifact(r.artifacts, "em_signoff");
                  const isPending = r.status === "awaiting_em_signoff";

                  return (
                    <Card
                      key={r.id}
                      className={cn(
                        "card-hover flex items-center justify-between p-4",
                        isPending && "border-l-4 border-l-amber-400"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{truncate(r.document_filename ?? r.id, 48)}</p>
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
                          {Boolean(engPayload?.reviewer) && (
                            <span>Eng reviewed by {String(engPayload?.reviewer)}</span>
                          )}
                          {emArt && (
                            <Badge className="bg-green-100 text-green-800 text-xs">Signed Off</Badge>
                          )}
                        </div>
                      </div>
                      <Button size="sm" asChild>
                        <Link to={`/em-signoff/${r.id}`}>{isPending ? "Sign Off" : "View"}</Link>
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
        <PageHeader title="EM Sign-off" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const engReviewArtifact = getArtifact(run.artifacts, "eng_review");
  const engPayload = engReviewArtifact?.json_payload as Record<string, unknown> | undefined;
  const emSignoffArtifact = getArtifact(run.artifacts, "em_signoff");
  const emPayload = emSignoffArtifact?.json_payload as Record<string, unknown> | undefined;
  const codeArt = getArtifact(run.artifacts, "code_analysis");
  const codePayload = codeArt?.json_payload as Record<string, unknown> | undefined;
  const canSign = run.status === "awaiting_em_signoff";

  if (!engPayload) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/em-signoff" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Engineer review must be completed first.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSignOff = () => {
    if (!manager.trim()) return;
    emSignoff.mutate({
      runId: run.id,
      manager: manager.trim(),
      comments: comments || undefined,
      action: "approve",
    });
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/em-signoff" className="inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Sign-off Queue
        </Link>
      </Button>

      <PageHeader
        title="EM Sign-off"
        description={`${truncate(run.document_filename ?? "Document", 48)}${run.jira ? ` · ${run.jira.jira_key}` : ""}`}
      />

      {/* Engineer Review summary */}
      <Card className="card-hover border-green-200 bg-green-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Engineer Review — {engPayload.status === "approved" ? "Approved" : String(engPayload.status)}
          </CardTitle>
          <CardDescription>
            By {String(engPayload.reviewer ?? "—")}
          </CardDescription>
        </CardHeader>
        {Boolean(engPayload.comments) && (
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{String(engPayload.comments)}</p>
          </CardContent>
        )}
      </Card>

      {/* Code analysis summary */}
      {codePayload && (
        <Card className="card-hover">
          <CardHeader>
            <CardTitle className="text-base">Code Analysis Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant={codePayload.is_valid_issue === true ? "success" : "destructive"}>
                {codePayload.is_valid_issue === true ? "Valid Issue" : "Not Valid"}
              </Badge>
            </div>
            {Boolean(codePayload.root_cause) && String(codePayload.root_cause).trim() !== "" && (
              <p className="text-sm text-muted-foreground">{truncate(String(codePayload.root_cause), 200)}</p>
            )}
            {Boolean(codePayload.pr_url) && String(codePayload.pr_url).trim() !== "" && (
              <a
                href={String(codePayload.pr_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
              >
                <GitPullRequest className="h-4 w-4" />
                View Pull Request
              </a>
            )}
          </CardContent>
        </Card>
      )}

      <Separator />

      {emPayload ? (
        <Card className="card-hover scale-pop border-green-200 bg-green-50/50">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <ShieldCheck className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-green-900">Signed Off — Issue Resolved</p>
              <p className="text-sm text-green-800">
                By {String(emPayload.manager)} · {run.status === "done" && "Marked as resolved"}
              </p>
              {Boolean(emPayload.comments) && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-green-800/90">
                  {String(emPayload.comments)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : canSign ? (
        <Card>
          <CardHeader>
            <CardTitle>Approve & Sign Off</CardTitle>
            <CardDescription>This is the final step — signing off marks the issue as resolved</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Manager Name</label>
              <Input value={manager} onChange={(e) => setManager(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Final Comments (optional)</label>
              <Textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Notes..." rows={4} />
            </div>
            <Button onClick={handleSignOff} disabled={!manager.trim() || emSignoff.isPending}>
              {emSignoff.isPending ? "Signing off…" : "Approve & Sign Off"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            This run is not currently awaiting EM sign-off.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
