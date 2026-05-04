export const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  processing: {
    label: "Processing",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
  },
  awaiting_uploader: {
    label: "Awaiting GTM Review",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
  },
  awaiting_pm: {
    label: "Awaiting PM Review",
    color: "text-purple-700",
    bg: "bg-purple-50 border-purple-200",
  },
  running_agent2: {
    label: "Classifying",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
  },
  creating_jira: {
    label: "Creating JIRA",
    color: "text-orange-700",
    bg: "bg-orange-50 border-orange-200",
  },
  awaiting_code_fix: {
    label: "Awaiting AutoResolve",
    color: "text-indigo-700",
    bg: "bg-indigo-50 border-indigo-200",
  },
  awaiting_eng_review: {
    label: "Awaiting Eng Review",
    color: "text-teal-700",
    bg: "bg-teal-50 border-teal-200",
  },
  awaiting_em_signoff: {
    label: "Awaiting EM Sign-off",
    color: "text-cyan-700",
    bg: "bg-cyan-50 border-cyan-200",
  },
  done: {
    label: "Resolved",
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
  },
  failed: {
    label: "Failed",
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
  },
};

export const PRIORITY_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  low: { label: "Low", color: "text-gray-600", bg: "bg-gray-100" },
  medium: { label: "Medium", color: "text-amber-700", bg: "bg-amber-100" },
  high: { label: "High", color: "text-orange-700", bg: "bg-orange-100" },
  critical: { label: "Critical", color: "text-red-700", bg: "bg-red-100" },
};

export const CLASSIFICATION_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  feature_request: {
    label: "Feature Request",
    color: "text-blue-700",
    bg: "bg-blue-100",
  },
  cri: { label: "CRI", color: "text-purple-700", bg: "bg-purple-100" },
  bug: { label: "Bug", color: "text-red-700", bg: "bg-red-100" },
  production_bug: {
    label: "Production Bug",
    color: "text-red-800",
    bg: "bg-red-200",
  },
  unknown: { label: "Unknown", color: "text-gray-600", bg: "bg-gray-100" },
};

export const WORKFLOW_STEPS = [
  { key: "upload", label: "Upload" },
  { key: "agent1", label: "AI Extract" },
  { key: "review", label: "GTM Review" },
  { key: "classify", label: "Classify" },
  { key: "jira", label: "JIRA" },
  { key: "code_fix", label: "Code Fix" },
  { key: "eng_review", label: "Eng Review" },
  { key: "em_signoff", label: "EM Sign-off" },
  { key: "done", label: "Done" },
] as const;

export type Role = "gtm" | "pm" | "engineering" | "admin";

export const ROLE_CONFIG: Record<
  Role,
  { label: string; description: string; color: string; icon: string; avatar: string }
> = {
  gtm: {
    label: "GTM",
    description: "Upload docs & review extractions",
    color: "bg-blue-500",
    icon: "Upload",
    avatar: "/avatars/gtm.svg",
  },
  pm: {
    label: "PM",
    description: "Classify, prioritize & approve",
    color: "bg-purple-500",
    icon: "ClipboardCheck",
    avatar: "/avatars/pm.svg",
  },
  engineering: {
    label: "Engineering",
    description: "Review code fixes & PRs",
    color: "bg-emerald-500",
    icon: "Code2",
    avatar: "/avatars/eng.svg",
  },
  admin: {
    label: "Admin",
    description: "Configure scoring & team mappings",
    color: "bg-gray-700",
    icon: "Settings",
    avatar: "/avatars/admin.svg",
  },
};

export const STEP_TO_INDEX: Record<string, number> = {
  upload: 0,
  agent1: 1,
  review: 2,
  uploader_review: 2,
  classify: 3,
  agent2: 3,
  pm_review: 3,
  jira: 4,
  creating_jira: 4,
  code_fix: 5,
  code_analysis: 5,
  eng_review: 6,
  em_signoff: 7,
  done: 8,
};

export const APP_NAME = "SnapResolve";
export const APP_TAGLINE = "Intelligent Issue Resolution Platform";

export const MODULES = [
  "Invoices",
  "Taxes",
  "Subscriptions",
  "UBB",
  "Payments",
] as const;

export type Module = (typeof MODULES)[number];

export const MODULE_CONFIG: Record<
  Module,
  { label: string; color: string; bg: string; icon: string }
> = {
  Invoices:      { label: "Invoices",      color: "text-blue-700",    bg: "bg-blue-100",    icon: "FileText" },
  Taxes:         { label: "Taxes",         color: "text-amber-700",   bg: "bg-amber-100",   icon: "Calculator" },
  Subscriptions: { label: "Subscriptions", color: "text-purple-700",  bg: "bg-purple-100",  icon: "RefreshCw" },
  UBB:           { label: "UBB",           color: "text-emerald-700", bg: "bg-emerald-100", icon: "BarChart3" },
  Payments:      { label: "Payments",      color: "text-orange-700",  bg: "bg-orange-100",  icon: "CreditCard" },
};
