import { useToastContext } from "@/context/ToastContext";

/**
 * Hook to trigger toast notifications from anywhere in the app.
 *
 * Usage:
 *   const { toast, dismiss } = useToast();
 *   toast.success("Story submitted!");
 *   toast.error("Something went wrong.");
 *   toast.info("Your session will expire soon.");
 */
function useToast() {
  const { addToast, removeToast } = useToastContext();

  const toast = {
    success: (message, options) =>
      addToast({ message, variant: "success", ...options }),
    error: (message, options) =>
      addToast({ message, variant: "error", ...options }),
    info: (message, options) =>
      addToast({ message, variant: "info", ...options }),
    default: (message, options) =>
      addToast({ message, variant: "default", ...options }),
  };

  return { toast, dismiss: removeToast };
}

export { useToast };
