import { forwardRef } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const variants = {
    primary:
      "bg-primary text-white hover:bg-primary-dark disabled:bg-surface-highest disabled:text-ink-soft",
    secondary:
      "bg-surface-high text-ink hover:bg-surface-highest border border-surface-highest",
    ghost: "bg-transparent text-primary hover:bg-primary/10",
    danger: "bg-red-700 text-white hover:bg-red-800",
  };
  return (
    <button
      className={`rounded-full px-5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-surface-low p-5 shadow-sm border border-surface-high ${className}`}>
      {children}
    </div>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label?: string }
>(function Input({ label, className = "", ...props }, ref) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs font-medium text-ink-soft">{label}</span>}
      <input
        ref={ref}
        className={`w-full rounded-xl border border-surface-highest bg-white px-3 py-2 text-sm outline-none focus:border-primary ${className}`}
        {...props}
      />
    </label>
  );
});

export function Spinner() {
  return (
    <div className="flex justify-center p-1">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-container border-t-primary" />
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "primary";
}) {
  const tones = {
    neutral: "bg-surface-high text-ink-soft",
    success: "bg-green-100 text-green-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
    primary: "bg-primary-container/40 text-primary-dark",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col rounded-2xl bg-surface-low shadow-xl max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-6 pt-6 pb-4 border-b border-surface-high">
          <h3 className="text-2xl font-semibold">{title}</h3>
        </div>
        <div className="modal-scroll overflow-y-auto px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </div>
  );
}
