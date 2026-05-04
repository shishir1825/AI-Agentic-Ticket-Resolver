import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileText, Info } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/layout/PageHeader";
import StepIndicator from "@/components/workflow/StepIndicator";
import StatusBadge from "@/components/workflow/StatusBadge";
import { useRuns, useApproveUploader, useRejectUploader } from "@/api/runs";
import { useRun } from "@/api/runs";
import { useDocument } from "@/api/documents";
import {
  CLASSIFICATION_CONFIG,
  MODULES,
  MODULE_CONFIG,
  type Role,
} from "@/lib/constants";
import { cn, formatDate, truncate } from "@/lib/utils";

interface Agent1Payload {
  title?: string;
  request_type_hint?: string;
  module?: string;
  problem_statement?: string;
  requirements?: Array<{ type: string; text: string }>;
  acceptance_criteria?: Array<{ text: string }>;
  impact?: { severity_hint?: string; who_is_affected?: string };
  related_product_areas?: Array<{ name: string }>;
  kb_validation?: { is_likely_supported_already?: string; notes?: string };
  questions_to_ask?: string[];
  confidence?: { overall?: number; title?: number; problem_statement?: number };
}

interface ReviewExtractionProps {
  role: Role;
}

function getAgent1Output(artifacts: { stage: string; version: number; json_payload: Record<string, unknown> }[]) {
  const agent1Artifacts = artifacts
    .filter((a) => a.stage === "agent1_output")
    .sort((a, b) => b.version - a.version);
  return agent1Artifacts[0]?.json_payload as Agent1Payload | undefined;
}

export default function ReviewExtraction({ role }: ReviewExtractionProps) {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [approverName, setApproverName] = useState("");
  const [comments, setComments] = useState("");
  const [edits, setEdits] = useState<Record<string, unknown>>({});

  const { data: runs = [], isLoading: runsLoading } = useRuns();
  const { data: run, isLoading: runLoading } = useRun(runId);
  const { data: document, isLoading: docLoading } = useDocument(
    run?.document_id
  );
  const approveUploader = useApproveUploader();
  const rejectUploader = useRejectUploader();

  const awaitingRuns = runs.filter((r) => r.status === "awaiting_uploader");
  const agent1 = run ? getAgent1Output(run.artifacts) : undefined;

  // No runId: run selector
  if (!runId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Review Extraction"
          description="Select a run to review the AI extraction"
        />
        {runsLoading ? (
          <p className="text-sm text-muted-foreground">Loading runs…</p>
        ) : awaitingRuns.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                No runs awaiting GTM review
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {awaitingRuns.map((r) => (
              <Card
                key={r.id}
                className="card-hover cursor-pointer transition-colors hover:border-cb-blue hover:bg-cb-blue/5"
                onClick={() => navigate(`/review/${r.id}`)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {truncate(r.document_filename ?? r.id, 32)}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <StatusBadge status={r.status} />
                    {formatDate(r.created_at)}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // runId: two-column layout
  if (runLoading || !run) {
    return (
      <div className="space-y-6">
        <PageHeader title="Review Extraction" />
        <p className="text-sm text-muted-foreground">Loading run…</p>
      </div>
    );
  }

  const filename = run.document_filename ?? document?.filename ?? "Document";
  const conf = agent1?.confidence?.overall ?? 0;
  const confPct = typeof conf === "number" && conf <= 1 ? conf * 100 : conf;
  const isGtm = role === "gtm";
  const isPm = role === "pm";
  const canApprove = isGtm && run.status === "awaiting_uploader";

  const handleTitleChange = (v: string) => {
    setEdits((e) => ({ ...e, title: v }));
  };
  const handleProblemChange = (v: string) => {
    setEdits((e) => ({ ...e, problem_statement: v }));
  };

  const handleApprove = () => {
    if (!approverName.trim()) return;
    approveUploader.mutate(
      {
        runId: run.id,
        approvedBy: approverName.trim(),
        comments: comments.trim() || undefined,
        edits: Object.keys(edits).length > 0 ? edits : undefined,
      },
      {
        onSuccess: () => navigate("/pm-review"),
      }
    );
  };

  const handleReject = () => {
    if (!approverName.trim()) return;
    rejectUploader.mutate(
      {
        runId: run.id,
        approvedBy: approverName.trim(),
        comments: comments.trim() || undefined,
      },
      {
        onSuccess: () => navigate("/review"),
      }
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Extraction"
        description={`Reviewing: ${truncate(filename, 48)}`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[55%_45%]">
        {/* Left: Source document */}
        <Card className="card-hover flex flex-col">
          <CardHeader>
            <CardTitle>Source Document</CardTitle>
            <CardDescription>{filename}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <pre
              className="h-[60vh] overflow-auto rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap font-sans"
              style={{ maxHeight: "60vh" }}
            >
              {docLoading
                ? "Loading document…"
                : document?.extracted_text ?? "No extracted text available"}
            </pre>
          </CardContent>
        </Card>

        {/* Right: Extraction editor */}
        <div className="space-y-4">
          <StepIndicator currentStep={run.current_step} status={run.status} />

          {/* Confidence bar */}
          <Card className="card-hover">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Confidence</CardTitle>
              <CardDescription>
                Overall: {Math.round(confPct)}%
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-4 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    "h-full transition-all",
                    confPct > 70 && "bg-cb-success",
                    confPct > 50 && confPct <= 70 && "bg-cb-warning",
                    confPct <= 50 && "bg-cb-danger"
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, confPct))}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {isPm && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>This extraction has been reviewed by GTM</span>
            </div>
          )}

          <Card className="card-hover">
            <CardHeader>
              <CardTitle className="text-base">Extracted Fields</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div>
                <label className="mb-1 block text-sm font-medium">Title</label>
                {isGtm && canApprove ? (
                  <Input
                    value={(edits.title as string) ?? agent1?.title ?? ""}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Title"
                  />
                ) : (
                  <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    {agent1?.title ?? "—"}
                  </p>
                )}
              </div>

              {/* Request Type */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Request Type
                </label>
                <Badge
                  variant="outline"
                  className={cn(
                    CLASSIFICATION_CONFIG[agent1?.request_type_hint ?? "unknown"]
                      ?.bg,
                    CLASSIFICATION_CONFIG[agent1?.request_type_hint ?? "unknown"]
                      ?.color
                  )}
                >
                  {CLASSIFICATION_CONFIG[agent1?.request_type_hint ?? "unknown"]
                    ?.label ?? agent1?.request_type_hint ?? "—"}
                </Badge>
              </div>

              {/* Module */}
              <div>
                <label className="mb-1 block text-sm font-medium">Module</label>
                {canApprove ? (
                  <select
                    value={(edits.module as string) ?? agent1?.module ?? ""}
                    onChange={(e) =>
                      setEdits((e2) => ({ ...e2, module: e.target.value }))
                    }
                    className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                  >
                    <option value="">—</option>
                    {MODULES.map((m) => (
                      <option key={m} value={m}>
                        {MODULE_CONFIG[m].label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge
                    variant="outline"
                    className={cn(
                      MODULE_CONFIG[agent1?.module as keyof typeof MODULE_CONFIG]
                        ?.bg,
                      MODULE_CONFIG[agent1?.module as keyof typeof MODULE_CONFIG]
                        ?.color
                    )}
                  >
                    {MODULE_CONFIG[agent1?.module as keyof typeof MODULE_CONFIG]
                      ?.label ?? agent1?.module ?? "—"}
                  </Badge>
                )}
              </div>

              {/* Problem Statement */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Problem Statement
                </label>
                {isGtm && canApprove ? (
                  <Textarea
                    value={
                      (edits.problem_statement as string) ??
                      agent1?.problem_statement ??
                      ""
                    }
                    onChange={(e) => handleProblemChange(e.target.value)}
                    placeholder="Problem statement"
                    rows={4}
                  />
                ) : (
                  <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap">
                    {agent1?.problem_statement ?? "—"}
                  </p>
                )}
              </div>

              {/* Requirements */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Requirements
                </label>
                <ul className="space-y-1">
                  {(agent1?.requirements ?? []).map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Badge variant="secondary" className="shrink-0">
                        {r.type}
                      </Badge>
                      <span className="text-sm">{r.text}</span>
                    </li>
                  ))}
                  {(!agent1?.requirements || agent1.requirements.length === 0) && (
                    <li className="text-sm text-muted-foreground">—</li>
                  )}
                </ul>
              </div>

              {/* Acceptance Criteria */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Acceptance Criteria
                </label>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {(agent1?.acceptance_criteria ?? []).map((ac, i) => (
                    <li key={i}>{ac.text}</li>
                  ))}
                  {(!agent1?.acceptance_criteria ||
                    agent1.acceptance_criteria.length === 0) && (
                    <li className="text-muted-foreground">—</li>
                  )}
                </ul>
              </div>

              {/* Impact */}
              <div>
                <label className="mb-1 block text-sm font-medium">Impact</label>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">Severity:</span>{" "}
                    {agent1?.impact?.severity_hint ?? "—"}
                  </p>
                  <p>
                    <span className="font-medium">Who is affected:</span>{" "}
                    {agent1?.impact?.who_is_affected ?? "—"}
                  </p>
                </div>
              </div>

              {/* Product Areas */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Product Areas
                </label>
                <div className="flex flex-wrap gap-1">
                  {(agent1?.related_product_areas ?? []).map((pa, i) => (
                    <Badge key={i} variant="outline">
                      {pa.name}
                    </Badge>
                  ))}
                  {(!agent1?.related_product_areas ||
                    agent1.related_product_areas.length === 0) && (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              </div>

              {/* KB Validation */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  KB Validation
                </label>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">Supported:</span>{" "}
                    {agent1?.kb_validation?.is_likely_supported_already ?? "—"}
                  </p>
                  <p>
                    <span className="font-medium">Notes:</span>{" "}
                    {agent1?.kb_validation?.notes ?? "—"}
                  </p>
                </div>
              </div>

              {/* Questions to Ask */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Questions to Ask
                </label>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {(agent1?.questions_to_ask ?? []).map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                  {(!agent1?.questions_to_ask ||
                    agent1.questions_to_ask.length === 0) && (
                    <li className="text-muted-foreground">—</li>
                  )}
                </ul>
              </div>

              {/* GTM Approve section */}
              {canApprove && (
                <>
                  <div className="border-t pt-4">
                    <label className="mb-1 block text-sm font-medium">
                      Your Name
                    </label>
                    <Input
                      value={approverName}
                      onChange={(e) => setApproverName(e.target.value)}
                      placeholder="Enter your name"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Comments
                    </label>
                    <Textarea
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder="Optional comments"
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={handleApprove}
                      disabled={!approverName.trim() || approveUploader.isPending || rejectUploader.isPending}
                      className="ripple"
                    >
                      {approveUploader.isPending
                        ? "Sending…"
                        : "Approve & Send to PM"}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleReject}
                      disabled={!approverName.trim() || approveUploader.isPending || rejectUploader.isPending}
                    >
                      {rejectUploader.isPending ? "Rejecting…" : "Reject"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
