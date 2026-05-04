import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

export interface JiraLink {
  jira_key: string;
  jira_url: string | null;
  created_at: string;
}

export interface Artifact {
  id: string;
  run_id: string;
  version: number;
  stage: string;
  json_payload: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

export interface RunDetail {
  id: string;
  document_id: string;
  status: string;
  current_step: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  artifacts: Artifact[];
  document_filename: string | null;
  jira: JiraLink | null;
}

export interface DocumentDetail {
  id: string;
  uploader_user_id: string;
  filename: string;
  mime_type: string;
  extracted_text: string | null;
  created_at: string;
}

export interface UploadResponse {
  document_id: string;
  run_id: string;
  filename: string;
}

export interface ScoringConfig {
  id: string;
  weights: Record<string, number>;
  thresholds: Record<string, number>;
  updated_by: string;
}

export interface TeamMapping {
  id: string;
  product_area: string;
  owning_team: string;
  jira_component: string | null;
}

export interface JiraHistoryIssue {
  key: string;
  url: string;
  summary: string;
  status: string;
  issue_type: string;
  priority: string;
  created: string;
  updated: string;
  assignee: string;
  labels: string[];
}

export interface PaginatedRuns {
  items: RunDetail[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export default api;
