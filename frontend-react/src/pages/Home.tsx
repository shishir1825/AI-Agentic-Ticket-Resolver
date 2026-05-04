import { Link, useNavigate } from "react-router-dom";
import {
  FileText,
  Upload,
  ClipboardList,
  AlertCircle,
  ExternalLink,
  Activity,
  CheckCircle2,
  Sparkles,
  BarChart3,
  UserCheck,
  ShieldCheck,
  Wrench,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import RoleAvatar from "@/components/ui/role-avatar";
import { SkeletonTable } from "@/components/ui/skeleton";
import StatusBadge from "@/components/workflow/StatusBadge";
import AnimatedWorkflow from "@/components/workflow/AnimatedWorkflow";
import { useRuns } from "@/api/runs";
import {
  ROLE_CONFIG,
  WORKFLOW_STEPS,
  STEP_TO_INDEX,
  APP_NAME,
  APP_TAGLINE,
} from "@/lib/constants";
import type { Role } from "@/lib/constants";
import { cn, formatDate, shortId, truncate } from "@/lib/utils";

interface HomeProps {
  role: Role;
}

export default function Home({ role }: HomeProps) {
  const navigate = useNavigate();
  const { data: runs = [], isLoading } = useRuns();

  const totalRuns = runs.length;
  const jirasCreated = runs.filter((r) => r.jira != null).length;
  const pendingGtm = runs.filter((r) => r.status === "awaiting_uploader").length;
  const pendingPm = runs.filter((r) => r.status === "awaiting_pm").length;
  const awaitingCodeFix = runs.filter((r) => r.status === "awaiting_code_fix").length;
  const awaitingEngReview = runs.filter((r) => r.status === "awaiting_eng_review").length;
  const awaitingEmSignoff = runs.filter((r) => r.status === "awaiting_em_signoff").length;
  const resolved = runs.filter((r) => r.status === "done").length;
  const failed = runs.filter((r) => r.status === "failed").length;

  const recentRuns = runs.slice(0, 10);
  const roleConfig = ROLE_CONFIG[role];

  const pendingActions: { label: string; count: number; to: string; icon: typeof FileText }[] = [];
  if (role === "gtm" || role === "admin") {
    if (pendingGtm > 0) pendingActions.push({ label: "GTM Reviews", count: pendingGtm, to: "/review", icon: FileText });
  }
  if (role === "pm" || role === "admin") {
    if (pendingPm > 0) pendingActions.push({ label: "PM Reviews", count: pendingPm, to: "/pm-review", icon: ClipboardList });
  }
  if (role === "engineering" || role === "admin") {
    if (awaitingCodeFix > 0) pendingActions.push({ label: "AutoResolve", count: awaitingCodeFix, to: "/code-fix", icon: Wrench });
    if (awaitingEngReview > 0) pendingActions.push({ label: "Eng Reviews", count: awaitingEngReview, to: "/engineer-review", icon: UserCheck });
    if (awaitingEmSignoff > 0) pendingActions.push({ label: "EM Sign-offs", count: awaitingEmSignoff, to: "/em-signoff", icon: ShieldCheck });
  }

  return (
    <div className="space-y-8">
      {/* Hero section */}
      <Card className="card-hover overflow-hidden border-0 bg-gradient-to-br from-cb-blue to-cb-navy text-white shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-3xl font-bold tracking-tight">
              {APP_NAME}
            </CardTitle>
            <RoleAvatar role={role} size="lg" />
          </div>
          <CardDescription className="text-white/90 text-base font-medium">
            {APP_TAGLINE}
          </CardDescription>
          <CardDescription className="text-white/80">
            {roleConfig.description} — Logged in as {roleConfig.label}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {([
            { to: "/upload", label: "Upload New", icon: Upload, roles: ["gtm", "admin"] },
            { to: "/review", label: "GTM Review", icon: FileText, roles: ["gtm", "pm", "admin"] },
            { to: "/pm-review", label: "PM Review", icon: ClipboardList, roles: ["pm", "admin"] },
            { to: "/code-fix", label: "AutoResolve", icon: Sparkles, roles: ["pm", "engineering", "admin"] },
            { to: "/engineer-review", label: "Eng Review", icon: UserCheck, roles: ["engineering", "admin"] },
            { to: "/em-signoff", label: "EM Sign-off", icon: ShieldCheck, roles: ["engineering", "admin"] },
            { to: "/analytics", label: "Analytics", icon: BarChart3 },
            { to: "/timeline", label: "Activity Log", icon: Clock },
            { to: "/jira-board", label: "JIRA Board", icon: ExternalLink },
          ] as { to: string; label: string; icon: typeof Upload; roles?: string[] }[])
            .filter((btn) => !btn.roles || btn.roles.includes(role))
            .map((btn) => (
            <Button
              key={btn.to}
              asChild
              variant="secondary"
              className="ripple bg-white/20 hover:bg-white/30 text-white border-0 transition-transform hover:scale-105"
            >
              <Link to={btn.to} className="inline-flex items-center gap-2">
                <btn.icon className="h-3.5 w-3.5" />
                {btn.label}
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Pending Actions (role-specific) */}
      {pendingActions.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-800">
              <AlertCircle className="h-5 w-5" />
              Your Pending Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {pendingActions.map((pa) => (
                <Button
                  key={pa.to}
                  asChild
                  variant="outline"
                  className="border-amber-300 bg-white hover:bg-amber-50"
                >
                  <Link to={pa.to} className="inline-flex items-center gap-2">
                    <pa.icon className="h-4 w-4 text-amber-700" />
                    <span className="font-semibold text-amber-900">{pa.count}</span>
                    <span className="text-amber-700">{pa.label}</span>
                  </Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics strip */}
      <div className="stagger-enter grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Total Runs", value: totalRuns, icon: Activity, iconBg: "bg-cb-blue/10", iconColor: "text-cb-blue" },
          { label: "Resolved", value: resolved, icon: CheckCircle2, iconBg: "bg-cb-success/20", iconColor: "text-cb-success" },
          { label: "JIRAs Created", value: jirasCreated, icon: ExternalLink, iconBg: "bg-blue-100", iconColor: "text-blue-700" },
          { label: "Awaiting Review", value: pendingGtm + pendingPm, icon: ClipboardList, iconBg: "bg-purple-100", iconColor: "text-purple-700" },
          { label: "Eng Pipeline", value: awaitingCodeFix + awaitingEngReview + awaitingEmSignoff, icon: Wrench, iconBg: "bg-indigo-100", iconColor: "text-indigo-700" },
        ].map((m) => (
          <Card key={m.label} className="card-hover">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={cn("rounded-lg p-2", m.iconBg)}>
                  <m.icon className={cn("h-5 w-5", m.iconColor)} />
                </div>
                <div>
                  <p className="text-2xl font-bold count-up">{m.value}</p>
                  <p className="text-sm text-muted-foreground">{m.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {failed > 0 && (
          <Card className="card-hover border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-cb-danger/20 p-2">
                  <AlertCircle className="h-5 w-5 text-cb-danger" />
                </div>
                <div>
                  <p className="text-2xl font-bold count-up">{failed}</p>
                  <p className="text-sm text-muted-foreground">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Animated Workflow Visualization */}
      <Card className="card-hover overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-cb-blue" />
            How It Works
          </CardTitle>
          <CardDescription>Watch the end-to-end resolution flow — 9 intelligent steps</CardDescription>
        </CardHeader>
        <CardContent>
          <AnimatedWorkflow />
        </CardContent>
      </Card>

      {/* Recent Runs table */}
      <Card className="card-hover">
        <CardHeader>
          <CardTitle>Recent Runs</CardTitle>
          <CardDescription>Last 10 workflow runs — click to view timeline</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={5} />
          ) : recentRuns.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No runs yet</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Doc</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Step</th>
                    <th className="px-4 py-3 text-left font-medium">JIRA Key</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.map((run) => (
                    <tr
                      key={run.id}
                      onClick={() => navigate(`/timeline/${run.id}`)}
                      className="cursor-pointer border-b last:border-0 row-hover"
                    >
                      <td className="px-4 py-3">
                        {truncate(run.document_filename ?? shortId(run.document_id), 24)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="px-4 py-3">
                        {WORKFLOW_STEPS[STEP_TO_INDEX[run.current_step] ?? 0]?.label ?? run.current_step}
                      </td>
                      <td className="px-4 py-3">
                        {run.jira ? (
                          <a
                            href={run.jira.jira_url ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-cb-blue hover:underline"
                          >
                            {run.jira.jira_key}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(run.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
