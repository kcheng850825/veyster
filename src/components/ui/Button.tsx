import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition " +
    "disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 " +
    "active:scale-[0.98]";
  const sizes: Record<Size, string> = {
    sm: "px-3.5 py-1.5 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3.5 text-base",
  };
  const variants: Record<Variant, string> = {
    primary: "bg-ink-900 text-white hover:bg-ink-800 shadow-soft",
    accent:  "text-white bg-brand-gradient shadow-pop hover:brightness-110",
    secondary: "bg-white border border-ink-200 text-ink-700 hover:border-ink-300 hover:bg-white",
    ghost: "text-ink-600 hover:bg-ink-50",
    danger: "bg-no-500 text-white hover:bg-no-600 shadow-soft",
  };
  return (
    <button
      className={clsx(base, sizes[size], variants[variant], className)}
      {...rest}
    />
  );
}
