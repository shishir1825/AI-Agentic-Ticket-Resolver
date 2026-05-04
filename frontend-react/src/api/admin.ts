import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "./client";
import type { ScoringConfig, TeamMapping } from "./client";

export function useScoringConfig() {
  return useQuery<ScoringConfig | null>({
    queryKey: ["scoring-config"],
    queryFn: () => api.get("/api/admin/scoring-config").then((r) => r.data),
  });
}

export function useUpdateScoringConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      weights: Record<string, number>;
      thresholds: Record<string, number>;
      updated_by: string;
    }) => api.put("/api/admin/scoring-config", body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scoring-config"] });
    },
  });
}

export function useTeamMappings() {
  return useQuery<TeamMapping[]>({
    queryKey: ["team-mappings"],
    queryFn: () => api.get("/api/admin/team-mappings").then((r) => r.data),
  });
}

export function useCreateTeamMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      product_area: string;
      owning_team: string;
      jira_component?: string;
    }) => api.post("/api/admin/team-mappings", body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-mappings"] });
    },
  });
}

export function useDeleteTeamMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/admin/team-mappings/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-mappings"] });
    },
  });
}
