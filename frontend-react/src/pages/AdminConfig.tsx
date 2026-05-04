import { useState, useEffect } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/layout/PageHeader";
import {
  useScoringConfig,
  useUpdateScoringConfig,
  useTeamMappings,
  useCreateTeamMapping,
  useDeleteTeamMapping,
} from "@/api/admin";
import { type Role } from "@/lib/constants";

const DEFAULT_WEIGHTS = {
  arr: 1,
  escalation: 1,
  strategic: 1,
  severity: 1,
  affected_customers: 1,
};

const DEFAULT_THRESHOLDS = {
  high_threshold: 70,
  low_threshold: 30,
};

interface AdminConfigProps {
  role: Role;
}

export default function AdminConfig({ role }: AdminConfigProps) {
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [productArea, setProductArea] = useState("");
  const [owningTeam, setOwningTeam] = useState("");
  const [jiraComponent, setJiraComponent] = useState("");

  const { data: scoringConfig, isLoading: configLoading } = useScoringConfig();
  const { data: mappings = [], isLoading: mappingsLoading } = useTeamMappings();
  const updateConfig = useUpdateScoringConfig();
  const createMapping = useCreateTeamMapping();
  const deleteMapping = useDeleteTeamMapping();

  useEffect(() => {
    if (scoringConfig) {
      setWeights({
        arr: scoringConfig.weights?.arr ?? 1,
        escalation: scoringConfig.weights?.escalation ?? 1,
        strategic: scoringConfig.weights?.strategic ?? 1,
        severity: scoringConfig.weights?.severity ?? 1,
        affected_customers: scoringConfig.weights?.affected_customers ?? 1,
      });
      setThresholds({
        high_threshold: scoringConfig.thresholds?.high_threshold ?? 70,
        low_threshold: scoringConfig.thresholds?.low_threshold ?? 30,
      });
    }
  }, [scoringConfig]);

  if (role !== "admin") {
    return (
      <div className="space-y-6">
        <PageHeader title="Admin Configuration" />
        <Card className="border-cb-warning/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Lock className="h-16 w-16 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">Access Denied</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You need admin privileges to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSaveConfig = () => {
    updateConfig.mutate({
      weights,
      thresholds,
      updated_by: "admin",
    });
  };

  const handleAddMapping = () => {
    if (!productArea.trim() || !owningTeam.trim()) return;
    createMapping.mutate(
      {
        product_area: productArea.trim(),
        owning_team: owningTeam.trim(),
        jira_component: jiraComponent.trim() || undefined,
      },
      {
        onSuccess: () => {
          setProductArea("");
          setOwningTeam("");
          setJiraComponent("");
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Configuration" description="Manage scoring weights and team mappings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="card-hover">
          <CardHeader>
            <CardTitle>Scoring Weights</CardTitle>
            <CardDescription>
              Configure priority scoring dimensions (0–10 each)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {configLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">ARR</label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={weights.arr}
                      onChange={(e) =>
                        setWeights((w) => ({
                          ...w,
                          arr: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Escalation</label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={weights.escalation}
                      onChange={(e) =>
                        setWeights((w) => ({
                          ...w,
                          escalation: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Strategic</label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={weights.strategic}
                      onChange={(e) =>
                        setWeights((w) => ({
                          ...w,
                          strategic: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Severity</label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={weights.severity}
                      onChange={(e) =>
                        setWeights((w) => ({
                          ...w,
                          severity: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Affected Customers</label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={weights.affected_customers}
                      onChange={(e) =>
                        setWeights((w) => ({
                          ...w,
                          affected_customers: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 pt-2">
                  <div>
                    <label className="text-sm font-medium">High Threshold (0–100)</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={thresholds.high_threshold}
                      onChange={(e) =>
                        setThresholds((t) => ({
                          ...t,
                          high_threshold: parseInt(e.target.value, 10) || 0,
                        }))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Low Threshold (0–100)</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={thresholds.low_threshold}
                      onChange={(e) =>
                        setThresholds((t) => ({
                          ...t,
                          low_threshold: parseInt(e.target.value, 10) || 0,
                        }))
                      }
                      className="mt-1"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleSaveConfig}
                  disabled={updateConfig.isPending}
                  className="ripple mt-4"
                >
                  {updateConfig.isPending ? "Saving…" : "Save Configuration"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader>
            <CardTitle>Team Mappings</CardTitle>
            <CardDescription>
              Map product areas to owning teams and JIRA components
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mappingsLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium">Product Area</th>
                        <th className="px-4 py-3 text-left font-medium">Owning Team</th>
                        <th className="px-4 py-3 text-left font-medium">JIRA Component</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappings.map((m, i) => (
                        <tr
                          key={m.id}
                          className={`border-b last:border-0 ${i % 2 === 1 ? "bg-muted/20" : ""}`}
                        >
                          <td className="px-4 py-3">{m.product_area}</td>
                          <td className="px-4 py-3">{m.owning_team}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {m.jira_component ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-cb-danger hover:text-cb-danger"
                              onClick={() => deleteMapping.mutate(m.id)}
                              disabled={deleteMapping.isPending}
                            >
                              Delete
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-3 pt-4">
                  <Input
                    placeholder="Product Area"
                    value={productArea}
                    onChange={(e) => setProductArea(e.target.value)}
                    className="flex-1 min-w-[120px]"
                  />
                  <Input
                    placeholder="Owning Team"
                    value={owningTeam}
                    onChange={(e) => setOwningTeam(e.target.value)}
                    className="flex-1 min-w-[120px]"
                  />
                  <Input
                    placeholder="JIRA Component (optional)"
                    value={jiraComponent}
                    onChange={(e) => setJiraComponent(e.target.value)}
                    className="flex-1 min-w-[120px]"
                  />
                  <Button
                    onClick={handleAddMapping}
                    disabled={
                      createMapping.isPending ||
                      !productArea.trim() ||
                      !owningTeam.trim()
                    }
                    className="ripple"
                  >
                    {createMapping.isPending ? "Adding…" : "Add Mapping"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
