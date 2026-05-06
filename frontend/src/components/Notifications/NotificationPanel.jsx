import { useNavigate } from "react-router-dom";
import { Bell, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import NotificationItem from "./NotificationItem";

function NotificationPanel({
  notifications,
  unreadCount,
  loading,
  onMarkRead,
  onMarkAllRead,
  onClose,
}) {
  const navigate = useNavigate();

  const handleOpenPreferences = () => {
    onClose?.();
    navigate("/notifications/preferences");
  };

  return (
    <div
      role="dialog"
      aria-label="Notifications"
      className="w-80 max-w-[90vw] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md sm:w-96"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {unreadCount} unread
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkAllRead}
              className="h-8 px-2 text-xs"
            >
              Mark all as read
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenPreferences}
            aria-label="Notification preferences"
            className="h-8 w-8"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading && notifications.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Loading notifications…
          </p>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            message="You'll see updates about your stories, comments, and badges here."
            className="py-8"
          />
        ) : (
          <ul className="divide-y" role="list">
            {notifications.map((n) => (
              <li key={n.id}>
                <NotificationItem
                  notification={n}
                  onMarkRead={onMarkRead}
                  onClose={onClose}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default NotificationPanel;
