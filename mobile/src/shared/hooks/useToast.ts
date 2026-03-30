import { useToastContext } from '../toast/ToastContext';

interface ToastOptions {
  duration?: number;
}

export function useToast() {
  const { addToast, removeToast } = useToastContext();

  return {
    toast: {
      success: (message: string, options?: ToastOptions) =>
        addToast(message, { ...options, variant: 'success' }),
      error: (message: string, options?: ToastOptions) =>
        addToast(message, { ...options, variant: 'error' }),
      info: (message: string, options?: ToastOptions) =>
        addToast(message, { ...options, variant: 'info' }),
      show: (message: string, options?: ToastOptions) =>
        addToast(message, { ...options, variant: 'default' }),
    },
    dismiss: removeToast,
  };
}
