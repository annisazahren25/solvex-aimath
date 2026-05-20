import { AnimatePresence, motion } from "framer-motion";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImageOff, Crown, X, Plus, Sparkles, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createThreadSmart } from "@/lib/subscription.functions";

function getNextMidnight() {
  const d = new Date();
  d.setHours(24, 0, 0, 0); // next local midnight (00:00)
  return d;
}

function formatCountdown(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function UploadLimitModal({
  open,
  onClose,
  variant = "denied",
}: {
  open: boolean;
  onClose: () => void;
  /**
   * "denied" — user tried to upload more after the cap (default).
   * "reached" — user just consumed their last allowed upload(s).
   */
  variant?: "denied" | "reached";
}) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createThreadSmart);

  const newChat = useMutation({
    mutationFn: async () => create(),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      onClose();
      nav({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
  });


  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);

  const resetAt = getNextMidnight();
  const countdown = formatCountdown(resetAt.getTime() - now);
  const resetDateLabel = resetAt.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const resetTimeLabel = resetAt.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isReached = variant === "reached";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 px-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-glow"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
              <ImageOff className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold tracking-tight">
              {isReached
                ? "You've used all 5 uploads for today."
                : "You've reached today's upload limit."}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {isReached
                ? "Nice work! Start a fresh chat to keep solving, or upgrade to Pro for unlimited image uploads."
                : "Free plan includes 5 image uploads per day. Upgrade to Pro for unlimited uploads."}
            </p>
            <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-3 text-left">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" />
                Bisa upload lagi pada
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {resetDateLabel}
              </div>
              <div className="text-xs text-muted-foreground">
                Pukul {resetTimeLabel} WIB · sisa {countdown}
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <Button
                asChild
                className="rounded-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
              >
                <Link to="/pricing">
                  <Crown className="mr-2 h-4 w-4" /> Upgrade to Pro
                </Link>
              </Button>
              <Button
                onClick={() => newChat.mutate()}
                disabled={newChat.isPending}
                variant="outline"
                className="rounded-full"
              >
                {newChat.isPending ? (
                  <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Start new chat
              </Button>
              <button
                onClick={onClose}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Maybe later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
