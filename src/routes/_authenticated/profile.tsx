import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfile, listThreads } from "@/lib/chat.functions";
import { cancelSubscription } from "@/lib/subscription.functions";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, MessageSquare, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/solvex/logo";
import { TransactionHistory } from "@/components/solvex/transaction-history";
import { PlanBadge } from "@/components/solvex/plan-badge";
import { useSubscription } from "@/hooks/use-subscription";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/profile")({ component: Profile });

function Profile() {
  const { user } = useAuth();
  const gp = useServerFn(getProfile);
  const lt = useServerFn(listThreads);
  const cancelFn = useServerFn(cancelSubscription);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["profile", user?.id], queryFn: () => gp(), enabled: !!user });
  const { data: threads = [] } = useQuery({ queryKey: ["threads", user?.id], queryFn: () => lt(), enabled: !!user });
  const { isPro, plan, used, uploadsAllowed, adsToday, stats, refetch } = useSubscription();
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelFn();
      qc.invalidateQueries();
      refetch();
      toast.success("Subscription cancelled", {
        description: "You've been downgraded to the Free plan.",
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCancelling(false);
    }
  };

  const initial = user?.email?.[0]?.toUpperCase() ?? "U";
  const joined = user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—";

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <Link to="/chat"><Logo /></Link>
        <Button asChild variant="ghost" className="rounded-full"><Link to="/chat"><ArrowLeft className="mr-2 h-4 w-4" />Back to chat</Link></Button>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-8">
          <div className="flex items-start gap-3 sm:items-center sm:gap-5">
            <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-full bg-gradient-primary text-2xl font-bold text-primary-foreground shadow-glow sm:h-20 sm:w-20 sm:text-3xl">{initial}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl font-bold sm:text-2xl">{data?.profile?.full_name ?? user?.email}</h1>
                <PlanBadge isPro={isPro} size="sm" className="sm:px-3 sm:py-1 sm:text-xs" />
              </div>
              <p className="mt-0.5 max-w-full truncate text-sm text-muted-foreground">{user?.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Joined {joined} · Plan: {plan}
              </p>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Questions solved" value={data?.solvedCount ?? 0} />
            <Stat label="Total chats" value={threads.length} />
            <Stat
              label="Uploads today"
              value={isPro ? "∞" : `${used}/${uploadsAllowed}`}
            />
            <Stat label="Ads watched" value={stats?.total_ads_watched ?? adsToday ?? 0} />
          </div>
          {!isPro && (
            <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Unlock SolveX Pro</p>
                <p className="text-sm text-muted-foreground">Unlimited chats, uploads, no ads.</p>
              </div>
              <Button asChild className="rounded-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                <Link to="/pricing">Upgrade</Link>
              </Button>
            </div>
          )}
          {isPro && (
            <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-border bg-background px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">SolveX Pro subscription</p>
                <p className="text-sm text-muted-foreground">
                  Current plan: <span className="font-medium text-foreground">{plan}</span>
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="rounded-full text-destructive hover:text-destructive">
                    <XCircle className="mr-2 h-4 w-4" /> Stop subscription
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel SolveX Pro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You'll lose unlimited chats, unlimited image uploads, and ad-free
                      access immediately and be downgraded to the Free plan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Pro</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {cancelling ? "Cancelling…" : "Yes, cancel"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        <h2 className="mt-10 font-display text-lg font-semibold">Transaction history</h2>
        <div className="mt-3">
          <TransactionHistory />
        </div>

        <h2 className="mt-10 font-display text-lg font-semibold">Recent chats</h2>
        <ul className="mt-3 space-y-2">
          {threads.slice(0, 8).map((t) => (
            <li key={t.id}>
              <Link to="/chat/$threadId" params={{ threadId: t.id }} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition hover:border-primary/30 hover:shadow-soft">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{t.title}</span>
                <span className="text-xs text-muted-foreground">{new Date(t.updated_at).toLocaleDateString()}</span>
              </Link>
            </li>
          ))}
          {threads.length === 0 && <li className="text-sm text-muted-foreground">No chats yet.</li>}
        </ul>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4 sm:p-5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-primary sm:text-3xl">{value}</p>
    </div>
  );
}
