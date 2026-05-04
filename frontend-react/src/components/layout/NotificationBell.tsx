import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  useUnreadCount,
  useMarkRead,
  useMarkAllRead,
  type NotificationItem,
} from "@/api/notifications";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface NotificationBellProps {
  role: string;
}

export default function NotificationBell({ role }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data: notifications = [] } = useNotifications(role);
  const { data: unreadList = [] } = useUnreadCount(role);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const unreadCount = unreadList.filter((n) => !n.is_read).length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleClick = (notif: NotificationItem) => {
    if (!notif.is_read) markRead.mutate(notif.id);
    if (notif.link) {
      navigate(notif.link);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white glow-ring">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-2xl page-enter">
          {/* Header */}
          <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => markAllRead.mutate(role)}
                >
                  <CheckCheck className="mr-1 h-3 w-3" />
                  Read all
                </Button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="mx-auto h-8 w-8 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">No notifications</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors last:border-0",
                    notif.is_read
                      ? "bg-transparent hover:bg-muted/30"
                      : "bg-blue-50/50 hover:bg-blue-50"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                      notif.is_read ? "bg-transparent" : "bg-blue-500"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm", !notif.is_read && "font-semibold")}>
                      {notif.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {notif.message}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {timeAgo(notif.created_at)}
                    </p>
                  </div>
                  {notif.link && (
                    <ExternalLink className="mt-1 h-3 w-3 shrink-0 text-muted-foreground/50" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
