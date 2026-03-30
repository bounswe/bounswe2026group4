import React, { PropsWithChildren, useEffect, useMemo, useRef, useState } from 'react';
import { Toaster } from '../ui/Toast';
import { ShowToastOptions, ToastContext, ToastItem } from './ToastContext';

let toastCounter = 0;

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const removeToast = (id: number) => {
    const timer = timersRef.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timersRef.current[id];
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const addToast = (message: string, options?: ShowToastOptions) => {
    const id = ++toastCounter;
    const variant = options?.variant ?? 'default';
    const duration = options?.duration ?? 3000;

    setToasts((current) => [...current, { id, message, variant }]);

    timersRef.current[id] = setTimeout(() => {
      removeToast(id);
    }, duration);

    return id;
  };

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
      timersRef.current = {};
    };
  }, []);

  const value = useMemo(
    () => ({
      toasts,
      addToast,
      removeToast,
    }),
    [toasts],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster />
    </ToastContext.Provider>
  );
}
