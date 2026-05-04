import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "./client";
import type { RunDetail, PaginatedRuns } from "./client";

export function useRuns(params?: { page?: number; perPage?: number; status?: string; search?: string }) {
  const p = params?.page ?? 1;
  const pp = params?.perPage ?? 200;
  const qs = new URLSearchParams();
  qs.set("page", String(p));
  qs.set("per_page", String(pp));
  if (params?.status) qs.set("status", params.status);
  if (params?.search) qs.set("search", params.search);

  return useQuery<RunDetail[]>({
    queryKey: ["runs", p, pp, params?.status, params?.search],
    queryFn: () =>
      api.get(`/api/runs?${qs.toString()}`).then((r) => {
        const data = r.data;
        if (Array.isArray(data)) return data;
        return (data as PaginatedRuns).items;
      }),
    refetchInterval: 5000,
  });
}

export function useRunsPaginated(params?: { page?: number; perPage?: number; status?: string; search?: string }) {
  const p = params?.page ?? 1;
  const pp = params?.perPage ?? 20;
  const qs = new URLSearchParams();
  qs.set("page", String(p));
  qs.set("per_page", String(pp));
  if (params?.status) qs.set("status", params.status);
  if (params?.search) qs.set("search", params.search);

  return useQuery<PaginatedRuns>({
    queryKey: ["runs-paginated", p, pp, params?.status, params?.search],
    queryFn: () => api.get(`/api/runs?${qs.toString()}`).then((r) => r.data),
    refetchInterval: 5000,
  });
}

export function useRun(runId: string | undefined) {
  return useQuery<RunDetail>({
    queryKey: ["run", runId],
    queryFn: () => api.get(`/api/runs/${runId}`).then((r) => r.data),
    enabled: !!runId,
    refetchInterval: 3000,
  });
}

export function useTriggerAgent1() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) =>
      api.post(`/api/runs/${runId}/agent1`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["runs"] });
    },
  });
}

export function useApproveUploader() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      runId,
      approvedBy,
      comments,
      edits,
    }: {
      runId: string;
      approvedBy: string;
      comments?: string;
      edits?: Record<string, unknown>;
    }) =>
      api
        .post(`/api/runs/${runId}/approve/uploader`, {
          approved_by: approvedBy,
          comments,
          edits,
        })
        .then((r) => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["runs"] });
      qc.invalidateQueries({ queryKey: ["run", vars.runId] });
    },
  });
}

export function useApprovePM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      runId,
      approvedBy,
      comments,
      overrides,
    }: {
      runId: string;
      approvedBy: string;
      comments?: string;
      overrides?: Record<string, unknown>;
    }) =>
      api
        .post(`/api/runs/${runId}/approve/pm`, {
          approved_by: approvedBy,
          comments,
          overrides,
        })
        .then((r) => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["runs"] });
      qc.invalidateQueries({ queryKey: ["run", vars.runId] });
    },
  });
}

export function useRejectUploader() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      runId,
      approvedBy,
      comments,
    }: {
      runId: string;
      approvedBy: string;
      comments?: string;
    }) =>
      api
        .post(`/api/runs/${runId}/reject/uploader`, {
          approved_by: approvedBy,
          comments,
        })
        .then((r) => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["runs"] });
      qc.invalidateQueries({ queryKey: ["run", vars.runId] });
    },
  });
}

export function useRejectPM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      runId,
      approvedBy,
      comments,
    }: {
      runId: string;
      approvedBy: string;
      comments?: string;
    }) =>
      api
        .post(`/api/runs/${runId}/reject/pm`, {
          approved_by: approvedBy,
          comments,
        })
        .then((r) => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["runs"] });
      qc.invalidateQueries({ queryKey: ["run", vars.runId] });
    },
  });
}

export function useRetryJira() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) =>
      api.post(`/api/runs/${runId}/retry-jira`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["runs"] });
    },
  });
}

export function useAnalyzeCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) =>
      api.post(`/api/runs/${runId}/analyze-code`).then((r) => r.data),
    onSuccess: (_data, runId) => {
      qc.invalidateQueries({ queryKey: ["run", runId] });
      qc.invalidateQueries({ queryKey: ["runs"] });
    },
  });
}

export function useJiraPayload(runId: string | undefined) {
  return useQuery({
    queryKey: ["jira-payload", runId],
    queryFn: () => api.get(`/api/runs/${runId}/jira-payload`).then((r) => r.data),
    enabled: !!runId,
  });
}

export function useEngineerReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      runId,
      status,
      reviewer,
      comments,
    }: {
      runId: string;
      status: string;
      reviewer: string;
      comments?: string;
    }) =>
      api
        .post(`/api/runs/${runId}/review/engineer`, { status, reviewer, comments })
        .then((r) => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["runs"] });
      qc.invalidateQueries({ queryKey: ["run", vars.runId] });
    },
  });
}

export function useEMSignoff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      runId,
      manager,
      comments,
      action,
    }: {
      runId: string;
      manager: string;
      comments?: string;
      action?: string;
    }) =>
      api
        .post(`/api/runs/${runId}/signoff/em`, { manager, comments, action: action ?? "approve" })
        .then((r) => r.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["runs"] });
      qc.invalidateQueries({ queryKey: ["run", vars.runId] });
    },
  });
}
