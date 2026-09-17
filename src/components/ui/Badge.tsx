import { cn } from "@/lib/cn";

type TomBadge = "success" | "warning" | "danger" | "info" | "neutral";

interface BadgeProps {
  children: string;
  tom?: TomBadge;
  className?: string;
}

const classesTom: Record<TomBadge, string> = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
  neutral: "bg-muted-bg text-muted",
};

export function Badge({ children, tom = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        classesTom[tom],
        className,
      )}
    >
      {children}
    </span>
  );
}
