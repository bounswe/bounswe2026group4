import * as React from "react";
import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const EmptyState = React.forwardRef(
  (
    {
      className,
      icon,
      title = "Nothing here yet",
      message = "There is no content to display at the moment.",
      actionLabel,
      onAction,
      ...props
    },
    ref
  ) => {
    const IconComponent = icon || Inbox;
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center gap-4 py-12 px-6 text-center",
          className
        )}
        {...props}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <IconComponent className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
        </div>
        {actionLabel && onAction && (
          <Button onClick={onAction}>{actionLabel}</Button>
        )}
      </div>
    );
  }
);
EmptyState.displayName = "EmptyState";

export { EmptyState };
