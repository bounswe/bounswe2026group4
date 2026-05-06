import { createElement } from "react";
import { useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";
import {
  formatRelativeTime,
  getNotificationIcon,
  getNotificationRoute,
} from "@/utils/notificationFormat";

function NotificationItem({ notification, onMarkRead, onClose }) {
  const navigate = useNavigate();
  const isUnread = !notification.is_read;

  const handleClick = async () => {
    if (isUnread) {
      await onMarkRead?.(notification.id);
    }
    const route = getNotificationRoute(notification);
    if (route) {
      onClose?.();
      navigate(route);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus:outline-none focus-visible:bg-muted/50",
        isUnread && "bg-primary/5"
      )}
      aria-label={
        isUnread
          ? `Unread notification: ${notification.message}`
          : `Notification: ${notification.message}`
      }
    >
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
          isUnread ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        {createElement(getNotificationIcon(notification.notification_type), {
          className: "h-4 w-4",
          "aria-hidden": "true",
        })}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm leading-snug",
            isUnread ? "font-medium text-foreground" : "text-muted-foreground"
          )}
        >
          {notification.message}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatRelativeTime(notification.created_at)}
        </p>
      </div>
      {isUnread && (
        <span
          className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-primary"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

export default NotificationItem;
