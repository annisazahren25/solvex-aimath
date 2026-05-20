import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChatLimitCard({ onNewChat }: { onNewChat: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-2xl rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-glow"
    >
      <div className="flex items-start gap-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-lg font-bold tracking-tight">
            This conversation has reached the free limit.
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Start a fresh chat or unlock unlimited messaging with SolveX Pro.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={onNewChat} variant="outline" className="rounded-full">
              <Plus className="mr-2 h-4 w-4" /> Start New Chat
            </Button>
            <Button
              asChild
              className="rounded-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            >
              <Link to="/pricing">
                <Sparkles className="mr-2 h-4 w-4" /> Upgrade to Pro
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function LockedAnswerCard({
  onWatchAd,
}: {
  onWatchAd: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-4"
    >
      <p className="font-display text-sm font-bold text-primary">
        Your answer is ready.
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Watch a short ad to reveal the full step-by-step solution.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          onClick={onWatchAd}
          className="rounded-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
          size="sm"
        >
          <Sparkles className="mr-2 h-3.5 w-3.5" /> Watch Ad
        </Button>
        <Button asChild variant="outline" className="rounded-full" size="sm">
          <Link to="/pricing">Upgrade to Pro</Link>
        </Button>
      </div>
    </motion.div>
  );
}
