'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot
  );
}

type ToastVariant = 'default' | 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  exiting: boolean;
}

const variantClasses: Record<ToastVariant, string> = {
  default: 'bg-card text-card-foreground',
  success: 'bg-success text-white',
  error: 'bg-destructive text-white',
  info: 'bg-info text-white',
};

function Toast({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => onDismiss(item.id), 4000);
    return () => clearTimeout(timeoutRef.current);
  }, [item.id, onDismiss]);

  return (
    <div
      role="alert"
      className={cn(
        'pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-[var(--shadow-lg)] dark:border dark:border-border/50',
        variantClasses[item.variant],
        item.exiting
          ? 'animate-[toast-slide-out_0.25s_ease-in_forwards]'
          : 'animate-[toast-slide-in_0.3s_ease-out]'
      )}
    >
      {item.message}
    </div>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  const mounted = useIsMounted();

  if (!mounted || toasts.length === 0) return null;

  return createPortal(
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <Toast key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body
  );
}

let nextId = 0;

function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'default') => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, variant, exiting: false }]);
    },
    []
  );

  return { toasts, toast, dismiss };
}

export { Toast, ToastContainer, useToast };
export type { ToastVariant };
