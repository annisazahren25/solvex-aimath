import { cn } from "@/lib/utils";

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary shadow-glow">
        <span className="font-display text-base font-bold text-primary-foreground">∑</span>
      </div>
      {withText && (
        <span className="font-display text-lg font-bold tracking-tight">
          Solve<span className="text-primary">X</span>
        </span>
      )}
    </div>
  );
}
