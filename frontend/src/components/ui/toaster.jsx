import * as React from "react";
import { X, CheckCircle, XCircle, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { useToastContext } from "@/context/ToastContext";

const variantConfig = {
  success: {
    icon: CheckCircle,
    className: "border-green-200 bg-green-50 text-green-900",
    iconClassName: "text-green-600",
  },
  error: {
    icon: XCircle,
    className: "border-destructive/20 bg-destructive/10 text-destructive",
    iconClassName: "text-destructive",
  },
  info: {
    icon: Info,
    className: "border-blue-200 bg-blue-50 text-blue-900",
    iconClassName: "text-blue-600",
  },
  default: {
    icon: null,
    className: "border-border bg-background text-foreground",
    iconClassName: "",
  },
};

function Toaster() {
  const { toasts, removeToast } = useToastContext();

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => {
        const config = variantConfig[toast.variant] ?? variantConfig.default;
        const IconComponent = config.icon;

        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg",
              config.className
            )}
          >
            {IconComponent && (
              <IconComponent
                className={cn("mt-0.5 h-4 w-4 shrink-0", config.iconClassName)}
                aria-hidden="true"
              />
            )}
            <p className="flex-1 text-sm leading-snug">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export { Toaster };
