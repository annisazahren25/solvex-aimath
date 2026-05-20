import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listTransactions } from "@/lib/subscription.functions";
import { useAuth } from "@/lib/auth-context";
import { PaymentMethodIcon } from "@/components/solvex/payment-method-icon";
import { cn } from "@/lib/utils";
import { Receipt } from "lucide-react";

const STATUS_STYLE: Record<string, string> = {
  success:   "bg-emerald-100 text-emerald-700",
  pending:   "bg-amber-100 text-amber-700",
  failed:    "bg-rose-100 text-rose-700",
  cancelled: "bg-slate-100 text-slate-600",
};

const PLAN_LABEL: Record<string, string> = {
  pro_weekly: "Weekly Pro",
  pro_monthly: "Monthly Pro",
  pro_yearly: "Yearly Pro",
  free: "Free",
};

export function TransactionHistory() {
  const { user } = useAuth();
  const lt = useServerFn(listTransactions);
  const { data, isLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: () => lt(),
    enabled: !!user,
  });
  const txs = data?.transactions ?? [];

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading billing history…</p>;
  }
  if (txs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-background/50 p-8 text-center">
        <Receipt className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">No transactions yet</p>
        <p className="text-xs text-muted-foreground">Your billing history will appear here.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {txs.map((t) => (
        <li key={t.id}
          className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 transition hover:border-primary/30 hover:shadow-soft"
        >
          <PaymentMethodIcon method={t.method} className="h-10 w-10 text-[9px]" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold">{PLAN_LABEL[t.plan] ?? t.plan}</p>
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                STATUS_STYLE[t.status] ?? STATUS_STYLE.pending,
              )}>{t.status}</span>
            </div>
            <p className="truncate font-mono text-[11px] text-muted-foreground">{t.reference}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-sm font-bold">Rp {t.amount.toLocaleString("id-ID")}</p>
            <p className="text-[11px] text-muted-foreground">
              {new Date(t.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
