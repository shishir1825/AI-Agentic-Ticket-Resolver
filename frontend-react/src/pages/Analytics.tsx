import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  XCircle,
  BarChart3,
  Calculator,
  RefreshCw,
  CreditCard,
} from "lucide-react";
import {
  MODULES,
  MODULE_CONFIG,
  PRIORITY_CONFIG,
  CLASSIFICATION_CONFIG,
  type Role,
  type Module,
} from "@/lib/constants";
import { useRuns } from "@/api/runs";
import type { RunDetail } from "@/api/client";
import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/workflow/StatusBadge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { cn, formatDate, truncate } from "@/lib/utils";

interface AnalyticsProps {
  role: Role;
}

function getModuleFromRun(run: RunDetail): string {
  if (typeof window !== "undefined") {
    const override = localStorage.getItem(`module-override-${run.id}`);
    if (override) return override;
  }
  // Priority: pm_verified > agent2_output > verified_v1 > agent1_output
  const pm = run.artifacts.find((a) => a.stage === "pm_verified");
  if (pm) {
    const m = (pm.json_payload as Record<string, unknown>)?.module as string;
    if (m) return m;
  }
  const a2 = run.artifacts.find((a) => a.stage === "agent2_output");
  if (a2) {
    const m = (a2.json_payload as Record<string, unknown>)?.module as string;
    if (m) return m;
  }
  const a1 = run.artifacts.find(
    (a) => a.stage === "verified_v1" || a.stage === "agent1_output"
  );
  return ((a1?.json_payload as Record<string, unknown>)?.module as string) ?? "Unknown";
}

function getPriorityFromRun(run: RunDetail): string {
  const a2 = run.artifacts.find(
    (a) => a.stage === "pm_verified" || a.stage === "agent2_output"
  );
  return ((a2?.json_payload as Record<string, unknown>)?.priority as string) ?? "unknown";
}

function getClassificationFromRun(run: RunDetail): string {
  const a2 = run.artifacts.find(
    (a) => a.stage === "pm_verified" || a.stage === "agent2_output"
  );
  return ((a2?.json_payload as Record<string, unknown>)?.classification as string) ?? "unknown";
}

const MODULE_ICONS: Record<string, typeof FileText> = {
  Invoices: FileText,
  Taxes: Calculator,
  Subscriptions: RefreshCw,
  UBB: BarChart3,
  Payments: CreditCard,
};

export default function Analytics({ role }: AnalyticsProps) {
  const navigate = useNavigate();
  const { data: runs = [], isLoading } = useRuns();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sortCol, setSortCol] = useState<
    "module" | "total" | "resolved" | "open" | "failed" | "rate"
  >("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [editingModuleRunId, setEditingModuleRunId] = useState<string | null>(null);

  const canEditModule = role === "pm" || role === "admin";

  const total = runs.length;
  const resolved = runs.filter((r) => r.status === "done").length;
  const failed = runs.filter((r) => r.status === "failed").length;
  const open = runs.filter(
    (r) => r.status !== "done" && r.status !== "failed"
  ).length;

  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    runs.forEach((r) => {
      const m = getModuleFromRun(r);
      counts[m] = (counts[m] ?? 0) + 1;
    });
    return counts;
  }, [runs, refreshTrigger]);

  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    runs.forEach((r) => {
      const p = getPriorityFromRun(r);
      counts[p] = (counts[p] ?? 0) + 1;
    });
    return counts;
  }, [runs]);

  const classificationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    runs.forEach((r) => {
      const c = getClassificationFromRun(r);
      counts[c] = (counts[c] ?? 0) + 1;
    });
    return counts;
  }, [runs]);

  const moduleTableData = useMemo(() => {
    const allModules = [...new Set([...MODULES, ...Object.keys(moduleCounts)])];
    return allModules.map((mod) => {
      const modRuns = runs.filter((r) => getModuleFromRun(r) === mod);
      const total = modRuns.length;
      const resolved = modRuns.filter((r) => r.status === "done").length;
      const failed = modRuns.filter((r) => r.status === "failed").length;
      const open = total - resolved - failed;
      const rate = total > 0 ? (resolved / total) * 100 : 0;
      return {
        module: mod,
        total,
        resolved,
        open,
        failed,
        rate,
      };
    });
  }, [runs, refreshTrigger, moduleCounts]);

  const sortedTableData = useMemo(() => {
    const sorted = [...moduleTableData];
    sorted.sort((a, b) => {
      let va: string | number = a[sortCol];
      let vb: string | number = b[sortCol];
      if (sortCol === "module") {
        va = a.module;
        vb = b.module;
      }
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [moduleTableData, sortCol, sortDir]);

  const recentRuns = useMemo(
    () => [...runs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10),
    [runs]
  );

  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir(col === "module" ? "asc" : "desc");
    }
  };

  const handleModuleChange = (runId: string, newModule: string) => {
    localStorage.setItem(`module-override-${runId}`, newModule);
    setEditingModuleRunId(null);
    setRefreshTrigger((t) => t + 1);
  };

  const maxModuleCount = Math.max(...Object.values(moduleCounts), 1);
  const maxPriorityCount = Math.max(...Object.values(priorityCounts), 1);
  const maxClassificationCount = Math.max(...Object.values(classificationCounts), 1);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Analytics"
          description="Issue metrics and module distribution insights"
        />
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          Loading analytics…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description="Issue metrics and module distribution insights"
      />

      {/* Summary metrics strip */}
      <div className="stagger-enter grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-cb-blue/10 p-2">
                <FileText className="h-5 w-5 text-cb-blue" />
              </div>
              <div>
                <p className="text-2xl font-bold count-up">{total}</p>
                <p className="text-sm text-muted-foreground">Total Issues</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold count-up">{resolved}</p>
                <p className="text-sm text-muted-foreground">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold count-up">{open}</p>
                <p className="text-sm text-muted-foreground">Open</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-100 p-2">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold count-up">{failed}</p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Module distribution */}
      <Card className="card-hover">
        <CardHeader>
          <CardTitle>Module Distribution</CardTitle>
          <CardDescription>Issues grouped by product module</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="stagger-enter space-y-3">
            {Object.entries(moduleCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([mod, count]) => {
                const cfg = MODULE_CONFIG[mod as Module] ?? {
                  label: mod,
                  color: "text-gray-700",
                  bg: "bg-gray-100",
                  icon: "FileText",
                };
                const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
                const widthPct = maxModuleCount > 0 ? (count / maxModuleCount) * 100 : 0;
                const Icon = MODULE_ICONS[mod] ?? FileText;
                return (
                  <div key={mod} className="flex items-center gap-3">
                    <div className="flex w-28 shrink-0 items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{cfg.label}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "h-8 rounded-md transition-all duration-500",
                          cfg.bg,
                          cfg.color
                        )}
                        style={{ width: `${widthPct}%`, minWidth: count > 0 ? "2rem" : 0 }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right text-sm font-medium">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            {Object.keys(moduleCounts).length === 0 && (
              <p className="text-sm text-muted-foreground">No module data yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Priority distribution */}
        <Card className="card-hover">
          <CardHeader>
            <CardTitle>Priority Distribution</CardTitle>
            <CardDescription>Issues by priority level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="stagger-enter space-y-3">
              {Object.entries(priorityCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([pri, count]) => {
                  const cfg = PRIORITY_CONFIG[pri] ?? {
                    label: pri,
                    color: "text-gray-600",
                    bg: "bg-gray-100",
                  };
                  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
                  const widthPct = maxPriorityCount > 0 ? (count / maxPriorityCount) * 100 : 0;
                  return (
                    <div key={pri} className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-sm font-medium">{cfg.label}</span>
                      <div className="min-w-0 flex-1">
                        <div
                          className={cn(
                            "h-7 rounded-md transition-all duration-500",
                            cfg.bg,
                            cfg.color
                          )}
                          style={{ width: `${widthPct}%`, minWidth: count > 0 ? "2rem" : 0 }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right text-sm font-medium">
                        {count} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              {Object.keys(priorityCounts).length === 0 && (
                <p className="text-sm text-muted-foreground">No priority data yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Classification breakdown */}
        <Card className="card-hover">
          <CardHeader>
            <CardTitle>Classification Breakdown</CardTitle>
            <CardDescription>Issues by type (bug, feature, CRI, etc.)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="stagger-enter space-y-3">
              {Object.entries(classificationCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([cls, count]) => {
                  const cfg = CLASSIFICATION_CONFIG[cls] ?? {
                    label: cls.replace(/_/g, " "),
                    color: "text-gray-600",
                    bg: "bg-gray-100",
                  };
                  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
                  const widthPct = maxClassificationCount > 0 ? (count / maxClassificationCount) * 100 : 0;
                  return (
                    <div key={cls} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-sm font-medium">{cfg.label}</span>
                      <div className="min-w-0 flex-1">
                        <div
                          className={cn(
                            "h-7 rounded-md transition-all duration-500",
                            cfg.bg,
                            cfg.color
                          )}
                          style={{ width: `${widthPct}%`, minWidth: count > 0 ? "2rem" : 0 }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right text-sm font-medium">
                        {count} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              {Object.keys(classificationCounts).length === 0 && (
                <p className="text-sm text-muted-foreground">No classification data yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Issues by module table */}
      <Card className="card-hover">
        <CardHeader>
          <CardTitle>Issues by Module</CardTitle>
          <CardDescription>Detailed breakdown with resolution rates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th
                    className="cursor-pointer py-3 pr-4 font-medium hover:text-foreground"
                    onClick={() => handleSort("module")}
                  >
                    Module {sortCol === "module" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="cursor-pointer py-3 px-4 font-medium hover:text-foreground"
                    onClick={() => handleSort("total")}
                  >
                    Total {sortCol === "total" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="cursor-pointer py-3 px-4 font-medium hover:text-foreground"
                    onClick={() => handleSort("resolved")}
                  >
                    Resolved {sortCol === "resolved" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="cursor-pointer py-3 px-4 font-medium hover:text-foreground"
                    onClick={() => handleSort("open")}
                  >
                    Open {sortCol === "open" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="cursor-pointer py-3 px-4 font-medium hover:text-foreground"
                    onClick={() => handleSort("failed")}
                  >
                    Failed {sortCol === "failed" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="cursor-pointer py-3 pl-4 font-medium hover:text-foreground"
                    onClick={() => handleSort("rate")}
                  >
                    Resolution Rate {sortCol === "rate" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedTableData.map((row) => (
                  <tr
                    key={row.module}
                    className="row-hover border-b last:border-0"
                  >
                    <td className="py-3 pr-4 font-medium">{row.module}</td>
                    <td className="py-3 px-4">{row.total}</td>
                    <td className="py-3 px-4">{row.resolved}</td>
                    <td className="py-3 px-4">{row.open}</td>
                    <td className="py-3 px-4">{row.failed}</td>
                    <td className="py-3 pl-4">{row.rate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent issues list */}
      <Card className="card-hover">
        <CardHeader>
          <CardTitle>Recent Issues</CardTitle>
          <CardDescription>Last 10 issues with quick actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {recentRuns.map((run) => {
              const mod = getModuleFromRun(run);
              const pri = getPriorityFromRun(run);
              const cfg = MODULE_CONFIG[mod as Module] ?? {
                label: mod,
                color: "text-gray-600",
                bg: "bg-gray-100",
              };
              const priCfg = PRIORITY_CONFIG[pri] ?? {
                label: pri,
                color: "text-gray-600",
                bg: "bg-gray-100",
              };
              const isEditing = editingModuleRunId === run.id;
              return (
                <div
                  key={run.id}
                  className="row-hover flex cursor-pointer flex-wrap items-center gap-2 border-b py-3 last:border-0"
                  onClick={() => !isEditing && navigate(`/timeline/${run.id}`)}
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {truncate(run.document_filename ?? "Untitled", 35)}
                  </span>
                  {canEditModule && isEditing ? (
                    <select
                      className="rounded border px-2 py-1 text-sm"
                      value={mod}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleModuleChange(run.id, e.target.value);
                      }}
                      onBlur={() => setEditingModuleRunId(null)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {MODULES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                      <option value="Unknown">Unknown</option>
                    </select>
                  ) : (
                    <Badge
                      className={cn(
                        "cursor-pointer",
                        cfg.bg,
                        cfg.color,
                        canEditModule && "hover:ring-2"
                      )}
                      variant="outline"
                      onClick={(e) => {
                        if (canEditModule) {
                          e.stopPropagation();
                          setEditingModuleRunId(run.id);
                        }
                      }}
                    >
                      {cfg.label}
                    </Badge>
                  )}
                  <Badge className={cn(priCfg.bg, priCfg.color)} variant="outline">
                    {priCfg.label}
                  </Badge>
                  <StatusBadge status={run.status} />
                  {run.jira?.jira_key ? (
                    <a
                      href={run.jira.jira_url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cb-blue hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {run.jira.jira_key}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatDate(run.created_at)}
                  </span>
                </div>
              );
            })}
            {recentRuns.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No issues yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
