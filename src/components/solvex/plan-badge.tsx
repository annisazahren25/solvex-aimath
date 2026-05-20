import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function PlanBadge({
  isPro,
  className,
  size = "sm",
}: {
  isPro: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  const base =
    size === "md"
      ? "px-3 py-1 text-xs"
      : "px-2 py-0.5 text-[10px]";
  if (isPro) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider text-white shadow-glow",
          "bg-gradient-to-r from-primary to-primary-soft",
          base,
          className,
        )}
      >
        <Sparkles className="h-3 w-3" /> Pro
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted font-semibold uppercase tracking-wider text-muted-foreground",
        base,
        className,
      )}
    >
      Free
    </span>
  );
}
