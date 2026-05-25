import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  BookOpen,
  GraduationCap,
  Rocket,
  Target,
  Lock,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ExplanationMode =
  | "simple"
  | "detailed"
  | "teacher"
  | "fast"
  | "exam";

type ModeDef = {
  id: ExplanationMode;
  label: string;
  short: string;
  icon: React.ComponentType<{ className?: string }>;
  pro: boolean;
  tagline: string;
};

export const MODES: ModeDef[] = [
  { id: "simple", label: "Simple", short: "Simple", icon: Zap, pro: false, tagline: "Short & beginner friendly" },
  { id: "fast", label: "Fast Answer", short: "Fast", icon: Rocket, pro: false, tagline: "Final answer, minimal steps" },
  { id: "detailed", label: "Detailed", short: "Detailed", icon: BookOpen, pro: true, tagline: "Full step-by-step reasoning" },
  { id: "teacher", label: "Teacher", short: "Teacher", icon: GraduationCap, pro: true, tagline: "Friendly tutor explanations" },
  { id: "exam", label: "Exam Shortcut", short: "Exam", icon: Target, pro: true, tagline: "Tricks & efficient methods" },
];

export function getMode(id: ExplanationMode): ModeDef {
  return MODES.find((m) => m.id === id) ?? MODES[0];
}

export function ModeSelector({
  value,
  onChange,
  isPro,
}: {
  value: ExplanationMode;
  onChange: (m: ExplanationMode) => void;
  isPro: boolean;
}) {
  const [lockedOpen, setLockedOpen] = useState<ModeDef | null>(null);

  const handlePick = (m: ModeDef) => {
    if (m.pro && !isPro) {
      setLockedOpen(m);
      return;
    }
    onChange(m.id);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-3">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {MODES.map((m) => {
          const active = value === m.id;
          const locked = m.pro && !isPro;
          const Icon = m.icon;
          return (
            <motion.button
              key={m.id}
              type="button"
              onClick={() => handlePick(m)}
              whileTap={{ scale: 0.96 }}
              whileHover={{ y: -1 }}
              className={cn(
                "group relative inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all",
                active
                  ? "border-primary/40 bg-gradient-to-r from-primary to-primary-soft text-primary-foreground shadow-glow"
                  : "border-border bg-card text-foreground/80 hover:border-primary/30 hover:bg-primary/5 hover:text-primary",
                locked && !active && "opacity-70 hover:opacity-100",
              )}
              title={m.tagline}
            >
              {active && (
                <motion.span
                  layoutId="mode-glow"
                  className="absolute inset-0 -z-10 rounded-full bg-primary/30 blur-md"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <Icon className="h-3.5 w-3.5" />
              <span className="whitespace-nowrap">{m.label}</span>
              {locked && <Lock className="h-3 w-3 opacity-70" />}
            </motion.button>
          );
        })}
      </div>

      <Dialog open={!!lockedOpen} onOpenChange={(o) => !o && setLockedOpen(null)}>
        <DialogContent className="overflow-hidden border-primary/20 p-0 sm:max-w-md">
          <div className="relative bg-gradient-to-br from-primary/10 via-background to-primary-soft/10 p-6">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-soft shadow-glow"
            >
              <Sparkles className="h-7 w-7 text-primary-foreground" />
            </motion.div>
            <h2 className="mt-4 text-center font-display text-xl font-bold">
              {lockedOpen?.label} Mode is a Pro feature
            </h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Unlock advanced AI explanation modes with SolveX Pro — get
              detailed reasoning, a friendly teacher tone, and exam-ready
              shortcuts.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Button asChild className="h-11 rounded-full bg-gradient-to-r from-primary to-primary-soft text-primary-foreground shadow-glow">
                <Link to="/pricing">
                  <Sparkles className="mr-1.5 h-4 w-4" /> Upgrade to Pro
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="h-10 rounded-full"
                onClick={() => setLockedOpen(null)}
              >
                Maybe later
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ActiveModeBadge({ mode }: { mode: ExplanationMode }) {
  const m = getMode(mode);
  const Icon = m.icon;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={m.id}
        initial={{ opacity: 0, y: -4, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.95 }}
        transition={{ duration: 0.18 }}
        className="relative inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
      >
        <motion.span
          className="absolute inset-0 -z-10 rounded-full bg-primary/20 blur-md"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        />
        <Icon className="h-3.5 w-3.5" />
        {m.label} Mode Active
      </motion.div>
    </AnimatePresence>
  );
}
