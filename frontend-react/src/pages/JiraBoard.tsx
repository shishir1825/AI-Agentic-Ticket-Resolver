import { useState } from "react";
import { ExternalLink, AlertTriangle, RefreshCw } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/workflow/StatusBadge";
import { useRuns, useRetryJira } from "@/api/runs";
import { useJiraHistory } from "@/api/jira";
import { PRIORITY_CONFIG } from "@/lib/constants";
import { cn, formatDate, truncate } from "@/lib/utils";
import type { RunDetail } from "@/api/client";

function getPriorityFromRun(run: RunDetail): string {
  const a2 = run.artifacts.find(
    (a) => a.stage === "pm_verified" || a.stage === "agent2_output"
  );
  const payload = a2?.json_payload as Record<string, unknown> | undefined;
  return (payload?.priority as string) ?? "—";
}

function PriorityBadge({ priority }: { priority: string }) {
  if (!priority || priority === "—") {
    return <span className="text-muted-foreground">—</span>;
  }
  const cfg = PRIORITY_CONFIG[priority.toLowerCase()] ?? {
    label: priority,
    color: "text-gray-600",
    bg: "bg-gray-100",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        cfg.bg,
        cfg.color
      )}
    >
      {cfg.label}
    </span>
  );
}

export default function JiraBoard() {
  const [searchWorkflow, setSearchWorkflow] = useState("");
  const [searchNeedsAttention, setSearchNeedsAttention] = useState("");
  const [searchSnapp, setSearchSnapp] = useState("");

  const { data: runs = [], isLoading: runsLoading } = useRuns();
  const { data: jiraHistory, isLoading: jiraLoading, error: jiraError } = useJiraHistory(200);
  const retryJira = useRetryJira();

  const workflowRuns = runs.filter((r) => r.jira != null);
  const filteredWorkflow = searchWorkflow.trim()
    ? workflowRuns.filter((r) =>
        (r.document_filename ?? "").toLowerCase().includes(searchWorkflow.toLowerCase()) ||
        (r.jira?.jira_key ?? "").toLowerCase().includes(searchWorkflow.toLowerCase())
      )
    : workflowRuns;

  const needsAttentionRuns = runs.filter(
    (r) => r.status === "failed" || r.status === "creating_jira"
  );
  const filteredNeedsAttention = searchNeedsAttention.trim()
    ? needsAttentionRuns.filter((r) =>
        (r.document_filename ?? "").toLowerCase().includes(searchNeedsAttention.toLowerCase())
      )
    : needsAttentionRuns;

  const snappIssues = jiraHistory?.issues ?? [];
  const filteredSnapp = searchSnapp.trim()
    ? snappIssues.filter(
        (i) =>
          i.key.toLowerCase().includes(searchSnapp.toLowerCase()) ||
          i.summary.toLowerCase().includes(searchSnapp.toLowerCase())
      )
    : snappIssues;

  return (
    <div className="space-y-6">
      <PageHeader
        title="JIRA Board"
        description="Workflow JIRAs, needs attention, and all SNAPP tickets"
      />
      <Tabs defaultValue="workflow" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="workflow">Workflow JIRAs</TabsTrigger>
          <TabsTrigger value="attention">Needs Attention</TabsTrigger>
          <TabsTrigger value="snapp">All SNAPP Tickets</TabsTrigger>
        </TabsList>

        <TabsContent value="workflow" className="space-y-4">
          <div className="flex gap-4">
            <Input
              placeholder="Search by document or JIRA key..."
              value={searchWorkflow}
              onChange={(e) => setSearchWorkflow(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <Card>
            <CardContent className="p-0">
              {runsLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Loading…
                </p>
              ) : filteredWorkflow.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No workflow JIRAs found
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium">JIRA Key</th>
                        <th className="px-4 py-3 text-left font-medium">Document</th>
                        <th className="px-4 py-3 text-left font-medium">Priority</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWorkflow.map((r, i) => (
                        <tr
                          key={r.id}
                          className={cn(
                            "border-b last:border-0 row-hover",
                            i % 2 === 1 && "bg-muted/20"
                          )}
                        >
                          <td className="px-4 py-3">
                            <a
                              href={r.jira?.jira_url ?? "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-cb-blue hover:underline"
                            >
                              {r.jira?.jira_key}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </td>
                          <td className="px-4 py-3">
                            {truncate(r.document_filename ?? r.document_id, 32)}
                          </td>
                          <td className="px-4 py-3">
                            <PriorityBadge priority={getPriorityFromRun(r)} />
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(r.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attention" className="space-y-4">
          <div className="flex gap-4">
            <Input
              placeholder="Search by filename..."
              value={searchNeedsAttention}
              onChange={(e) => setSearchNeedsAttention(e.target.value)}
              className="max-w-sm"
            />
          </div>
          {filteredNeedsAttention.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No runs need attention
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredNeedsAttention.map((r) => (
                <Card
                  key={r.id}
                  className={cn(
                    "border-l-4",
                    r.status === "failed"
                      ? "border-l-cb-danger"
                      : "border-l-cb-warning"
                  )}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {truncate(r.document_filename ?? r.id, 28)}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <StatusBadge status={r.status} />
                      {formatDate(r.created_at)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {r.error_message && (
                      <p className="text-sm text-cb-danger">
                        {r.error_message}
                      </p>
                    )}
                    <Button
                      size="sm"
                      onClick={() => retryJira.mutate(r.id)}
                      disabled={retryJira.isPending}
                      className="w-full"
                    >
                      <RefreshCw
                        className={cn(
                          "mr-2 h-3.5 w-3.5",
                          retryJira.isPending && "animate-spin"
                        )}
                      />
                      Retry JIRA
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="snapp" className="space-y-4">
          {(jiraError || jiraHistory?.error) && (
            <Card className="border-cb-warning/50">
              <CardContent className="flex items-center gap-3 py-4">
                <AlertTriangle className="h-5 w-5 text-cb-warning shrink-0" />
                <p className="text-sm text-muted-foreground">
                  {jiraError ? String(jiraError) : jiraHistory?.error}
                </p>
              </CardContent>
            </Card>
          )}
          <div className="flex gap-4">
            <Input
              placeholder="Search by key or summary..."
              value={searchSnapp}
              onChange={(e) => setSearchSnapp(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <Card>
            <CardContent className="p-0">
              {jiraLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Loading SNAPP tickets…
                </p>
              ) : filteredSnapp.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No SNAPP tickets found
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium">Key</th>
                        <th className="px-4 py-3 text-left font-medium">Summary</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium">Type</th>
                        <th className="px-4 py-3 text-left font-medium">Priority</th>
                        <th className="px-4 py-3 text-left font-medium">Assignee</th>
                        <th className="px-4 py-3 text-left font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSnapp.map((issue, i) => (
                        <tr
                          key={issue.key}
                          className={cn(
                            "border-b last:border-0",
                            i % 2 === 1 && "bg-muted/20"
                          )}
                        >
                          <td className="px-4 py-3">
                            <a
                              href={issue.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-cb-blue hover:underline"
                            >
                              {issue.key}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </td>
                          <td className="px-4 py-3">
                            {truncate(issue.summary, 48)}
                          </td>
                          <td className="px-4 py-3">{issue.status}</td>
                          <td className="px-4 py-3">{issue.issue_type}</td>
                          <td className="px-4 py-3">
                            <PriorityBadge priority={issue.priority} />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {issue.assignee || "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(issue.created)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
