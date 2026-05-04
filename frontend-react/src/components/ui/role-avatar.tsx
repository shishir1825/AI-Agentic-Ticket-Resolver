import { Upload, ClipboardCheck, Code2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_CONFIG, type Role } from "@/lib/constants";

const ROLE_ICONS: Record<Role, React.ComponentType<{ className?: string }>> = {
  gtm: Upload,
  pm: ClipboardCheck,
  engineering: Code2,
  admin: Settings,
};

const ROLE_GRADIENTS: Record<Role, string> = {
  gtm: "from-blue-400 to-blue-600",
  pm: "from-purple-400 to-purple-600",
  engineering: "from-emerald-400 to-emerald-600",
  admin: "from-gray-500 to-gray-700",
};

interface RoleAvatarProps {
  role: Role;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export default function RoleAvatar({ role, size = "md", showLabel = false }: RoleAvatarProps) {
  const Icon = ROLE_ICONS[role];
  const gradient = ROLE_GRADIENTS[role];
  const config = ROLE_CONFIG[role];

  const sizeClasses = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-12 w-12",
  };

  const iconSizes = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-6 w-6",
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-gradient-to-br shadow-sm",
          sizeClasses[size],
          gradient
        )}
      >
        <Icon className={cn("text-white", iconSizes[size])} />
      </div>
      {showLabel && (
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white/90 truncate">{config.label}</p>
          <p className="text-[10px] text-white/50 truncate">{config.description}</p>
        </div>
      )}
    </div>
  );
}
