import { createContext, useContext } from 'react';

export type ToastVariant = 'default' | 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

export interface ShowToastOptions {
  duration?: number;
  variant?: ToastVariant;
}

export interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (message: string, options?: ShowToastOptions) => number;
  removeToast: (id: number) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToastContext() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToastContext must be used within ToastProvider');
  }

  return context;
}
