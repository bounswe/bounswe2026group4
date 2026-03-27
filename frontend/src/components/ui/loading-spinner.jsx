import * as React from "react";

import { cn } from "@/lib/utils";

const LoadingSpinner = React.forwardRef(
  ({ className, message, fullPage = false, size = "default", ...props }, ref) => {
    const sizeClasses = {
      sm: "h-4 w-4 border-2",
      default: "h-8 w-8 border-4",
      lg: "h-12 w-12 border-4",
    };

    return (
      <div
        ref={ref}
        role="status"
        className={cn(
          "flex flex-col items-center justify-center gap-3",
          fullPage && "min-h-screen",
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "animate-spin rounded-full border-muted border-t-primary",
            sizeClasses[size] ?? sizeClasses.default
          )}
          aria-hidden="true"
        />
        <span className="sr-only">Loading{message ? `: ${message}` : "..."}</span>
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </div>
    );
  }
);
LoadingSpinner.displayName = "LoadingSpinner";

export { LoadingSpinner };
