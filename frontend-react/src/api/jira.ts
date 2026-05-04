import { useQuery } from "@tanstack/react-query";
import api from "./client";
import type { JiraHistoryIssue } from "./client";

interface JiraHistoryResponse {
  issues: JiraHistoryIssue[];
  total: number;
  error?: string;
}

export function useJiraHistory(maxResults: number = 200) {
  return useQuery<JiraHistoryResponse>({
    queryKey: ["jira-history", maxResults],
    queryFn: () =>
      api
        .get("/api/jira/history", { params: { max_results: maxResults } })
        .then((r) => r.data),
    refetchInterval: 30000,
  });
}
