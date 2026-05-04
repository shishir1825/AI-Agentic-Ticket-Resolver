import { cn } from "@/lib/utils";
import { STATUS_CONFIG } from "@/lib/constants";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    color: "text-gray-600",
    bg: "bg-gray-50 border-gray-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        cfg.bg,
        cfg.color,
        className
      )}
    >
      {cfg.label}
    </span>
  );
}
