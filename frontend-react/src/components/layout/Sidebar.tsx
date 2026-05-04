import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  Upload,
  FileCheck,
  ClipboardCheck,
  Wrench,
  UserCheck,
  ShieldCheck,
  Clock,
  Settings,
  LayoutGrid,
  Menu,
  X,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_CONFIG, APP_NAME, type Role } from "@/lib/constants";
import ChargebeeLogo from "@/components/ui/chargebee-logo";
import RoleAvatar from "@/components/ui/role-avatar";
import NotificationBell from "@/components/layout/NotificationBell";

interface SidebarProps {
  role: Role;
  onRoleChange: (r: Role) => void;
}

const NAV_SECTIONS = [
  {
    title: "Workflow",
    items: [
      { to: "/", icon: Home, label: "Dashboard" },
      { to: "/upload", icon: Upload, label: "Upload", roles: ["gtm", "admin"] as Role[] },
      { to: "/review", icon: FileCheck, label: "Review Extraction", roles: ["gtm", "pm", "admin"] as Role[] },
      { to: "/pm-review", icon: ClipboardCheck, label: "PM Review", roles: ["pm", "admin"] as Role[] },
      { to: "/code-fix", icon: Wrench, label: "AutoResolve", roles: ["pm", "engineering", "admin"] as Role[] },
      { to: "/engineer-review", icon: UserCheck, label: "Engineer Review", roles: ["engineering", "admin"] as Role[] },
      { to: "/em-signoff", icon: ShieldCheck, label: "EM Sign-off", roles: ["engineering", "admin"] as Role[] },
    ],
  },
  {
    title: "Insights",
    items: [
      { to: "/analytics", icon: BarChart3, label: "Analytics" },
      { to: "/timeline", icon: Clock, label: "Activity Log" },
      { to: "/jira-board", icon: LayoutGrid, label: "JIRA Board" },
      { to: "/admin", icon: Settings, label: "Admin Config", roles: ["admin"] as Role[] },
    ],
  },
];

export default function Sidebar({ role, onRoleChange }: SidebarProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <ChargebeeLogo className="h-9 w-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold text-white tracking-tight">{APP_NAME}</h1>
          <p className="text-[10px] text-white/50">by Chargebee</p>
        </div>
        <NotificationBell role={role} />
      </div>

      {/* Role switcher — enlarged & prominent */}
      <div className="border-b border-white/10 px-3 py-4">
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-white/30">
          Switch Role
        </p>
        <div className="space-y-1.5">
          {(Object.entries(ROLE_CONFIG) as [Role, (typeof ROLE_CONFIG)[Role]][]).map(
            ([key, cfg]) => (
              <button
                key={key}
                onClick={() => onRoleChange(key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-200",
                  role === key
                    ? "bg-sidebar-accent/90 shadow-md shadow-sidebar-accent/20 ring-1 ring-sidebar-accent/40"
                    : "bg-sidebar-muted/40 hover:bg-sidebar-muted/70"
                )}
              >
                <RoleAvatar role={key} size="md" />
                <div className="min-w-0 flex-1">
                  <p className={cn(
                    "text-sm font-semibold truncate",
                    role === key ? "text-white" : "text-white/70"
                  )}>
                    {cfg.label}
                  </p>
                  <p className={cn(
                    "text-[11px] truncate",
                    role === key ? "text-white/70" : "text-white/40"
                  )}>
                    {cfg.description}
                  </p>
                </div>
                {role === key && (
                  <div className="relative h-2.5 w-2.5 shrink-0">
                    <div className="absolute inset-0 rounded-full bg-green-400 ping-dot" />
                    <div className="absolute inset-0 rounded-full bg-green-400" />
                  </div>
                )}
              </button>
            )
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items
                .filter((item) => !item.roles || item.roles.includes(role))
                .map((item) => {
                  const isActive =
                    item.to === "/"
                      ? location.pathname === "/"
                      : location.pathname.startsWith(item.to);
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200",
                          isActive
                            ? "bg-sidebar-accent text-white shadow-sm shadow-sidebar-accent/30"
                            : "text-white/60 hover:bg-white/5 hover:text-white/90"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-lg bg-sidebar-muted/50 px-3 py-2">
          <RoleAvatar role={role} size="sm" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-white/80 truncate">{ROLE_CONFIG[role].label}</p>
            <p className="text-[10px] text-white/40 truncate">{ROLE_CONFIG[role].description}</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar text-white shadow-lg lg:hidden"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
