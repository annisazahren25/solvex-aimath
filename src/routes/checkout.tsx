import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Check, ShieldCheck, Lock, Sparkles, Copy, RefreshCw,
  CheckCircle2, Clock, X as XIcon, Receipt, Loader2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/solvex/logo";
import { AnimatedBackground } from "@/components/solvex/animated-background";
import { PaymentMethodIcon } from "@/components/solvex/payment-method-icon";
import { FakeQR } from "@/components/solvex/fake-qr";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  createTransaction, confirmTransaction, cancelTransaction,
} from "@/lib/subscription.functions";
import { useSubscription } from "@/hooks/use-subscription";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  plan: z.enum(["pro_weekly", "pro_monthly", "pro_yearly"]).default("pro_monthly"),
});

export const Route = createFileRoute("/checkout")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Checkout — SolveX Pro" },
      { name: "description", content: "Secure SolveX Pro checkout with GoPay, OVO, DANA, QRIS and more." },
    ],
  }),
  component: CheckoutPage,
});

type PlanId = "pro_weekly" | "pro_monthly" | "pro_yearly";

const PLAN_INFO: Record<PlanId, { name: string; price: string; period: string; amount: number; perks: string[] }> = {
  pro_weekly:  { name: "Weekly Pro",  price: "Rp 19.000",  period: "week",  amount: 19000,
    perks: ["Unlimited messaging", "Unlimited uploads", "Zero ads", "Faster AI"] },
  pro_monthly: { name: "Monthly Pro", price: "Rp 49.000",  period: "month", amount: 49000,
    perks: ["Unlimited messaging", "Unlimited uploads", "Zero ads", "Faster AI", "Advanced explanations"] },
  pro_yearly:  { name: "Yearly Pro",  price: "Rp 299.000", period: "year",  amount: 299000,
    perks: ["Unlimited messaging", "Unlimited uploads", "Zero ads", "Faster AI", "Advanced explanations", "Save 50%"] },
};

type Method = {
  id: string;
  name: string;
  description: string;
  group: "E-Wallet" | "QRIS" | "Bank Transfer" | "Card";
  kind: "wallet" | "qr" | "va" | "card";
};

const METHODS: Method[] = [
  { id: "gopay",     name: "GoPay",     description: "Pay with GoPay balance",    group: "E-Wallet", kind: "wallet" },
  { id: "ovo",       name: "OVO",       description: "Pay with OVO balance",      group: "E-Wallet", kind: "wallet" },
  { id: "dana",      name: "DANA",      description: "Pay with DANA balance",     group: "E-Wallet", kind: "wallet" },
  { id: "shopeepay", name: "ShopeePay", description: "Pay with ShopeePay",        group: "E-Wallet", kind: "wallet" },
  { id: "qris",      name: "QRIS",      description: "Scan with any banking app", group: "QRIS",     kind: "qr" },
  { id: "bca",       name: "BCA Virtual Account",     description: "Transfer via BCA VA",     group: "Bank Transfer", kind: "va" },
  { id: "mandiri",   name: "Mandiri Virtual Account", description: "Transfer via Mandiri VA", group: "Bank Transfer", kind: "va" },
  { id: "bni",       name: "BNI Virtual Account",     description: "Transfer via BNI VA",     group: "Bank Transfer", kind: "va" },
  { id: "card",      name: "Credit / Debit Card",     description: "Visa · Mastercard · JCB", group: "Card",          kind: "card" },
];

type Step = "select" | "pay" | "success";

function CheckoutPage() {
  const { plan } = Route.useSearch() as { plan: PlanId };
  const info = PLAN_INFO[plan];
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { isPro, refetch } = useSubscription();
  const createTx = useServerFn(createTransaction);
  const confirmTx = useServerFn(confirmTransaction);
  const cancelTx = useServerFn(cancelTransaction);

  const [step, setStep] = useState<Step>("select");
  const [selected, setSelected] = useState<string>("gopay");
  const [tx, setTx] = useState<{ id: string; reference: string } | null>(null);
  const [completedTx, setCompletedTx] = useState<{ reference: string; method: string; amount: number } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const method = METHODS.find((m) => m.id === selected)!;
  const groups = ["E-Wallet", "QRIS", "Bank Transfer", "Card"] as const;

  const startPayment = async () => {
    if (!user) { nav({ to: "/login" }); return; }
    try {
      const row = await createTx({ data: { plan, method: selected, amount: info.amount } });
      setTx({ id: row.id, reference: row.reference });
      setStep("pay");
    } catch (e) { toast.error((e as Error).message); }
  };

  const completePayment = async () => {
    if (!tx) return;
    setVerifying(true);
    try {
      // Realistic "verifying with bank" delay
      await new Promise((r) => setTimeout(r, 1800));
      const res = await confirmTx({ data: { transactionId: tx.id } });
      qc.invalidateQueries();
      refetch();
      setCompletedTx({
        reference: res.transaction.reference,
        method: res.transaction.method,
        amount: res.transaction.amount,
      });
      setStep("success");
      // Confetti burst
      const fire = (opts: confetti.Options) =>
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 }, colors: ["#3B82F6", "#60A5FA", "#93C5FD", "#0F172A"], ...opts });
      fire({});
      setTimeout(() => fire({ angle: 60, origin: { x: 0, y: 0.7 } }), 200);
      setTimeout(() => fire({ angle: 120, origin: { x: 1, y: 0.7 } }), 400);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setVerifying(false);
    }
  };

  const cancelPayment = async () => {
    if (tx) { try { await cancelTx({ data: { transactionId: tx.id } }); } catch {} }
    setTx(null);
    setStep("select");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-soft">
      <AnimatedBackground variant="soft" />
      <header className="relative z-10 flex items-center justify-between border-b border-border bg-card/70 px-6 py-4 backdrop-blur">
        <Link to="/"><Logo /></Link>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>Secured checkout</span>
        </div>
      </header>

      <StepIndicator step={step} />

      <main className="mx-auto max-w-5xl px-6 pb-16">
        <AnimatePresence mode="wait">
          {step === "select" && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="grid gap-6 lg:grid-cols-[1fr_380px]"
            >
              <section className="rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
                <h1 className="font-display text-2xl font-bold">Choose payment method</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick how you'd like to pay. You'll be guided through every step.
                </p>
                <div className="mt-6 space-y-6">
                  {groups.map((g) => (
                    <div key={g}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {METHODS.filter((m) => m.group === g).map((m) => {
                          const active = selected === m.id;
                          return (
                            <motion.button
                              key={m.id} type="button" onClick={() => setSelected(m.id)}
                              whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
                              className={cn(
                                "group relative flex items-center gap-3 rounded-2xl border p-4 text-left transition",
                                active
                                  ? "border-primary bg-primary/5 shadow-glow ring-2 ring-primary/20"
                                  : "border-border bg-background hover:border-primary/40 hover:shadow-soft",
                              )}
                            >
                              <PaymentMethodIcon method={m.id} />
                              <div className="flex-1">
                                <p className="text-sm font-semibold">{m.name}</p>
                                <p className="text-xs text-muted-foreground">{m.description}</p>
                              </div>
                              <div className={cn(
                                "grid h-6 w-6 place-items-center rounded-full border-2 transition",
                                active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
                              )}>
                                {active && <Check className="h-3.5 w-3.5" />}
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <OrderSummary info={info} cta={
                <Button
                  onClick={startPayment} disabled={isPro}
                  className="mt-5 w-full rounded-xl bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                >
                  {isPro ? "You're already Pro" : `Continue to pay ${info.price}`}
                </Button>
              } />
            </motion.div>
          )}

          {step === "pay" && tx && (
            <motion.div
              key="pay"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="grid gap-6 lg:grid-cols-[1fr_380px]"
            >
              <PaymentInstructions
                method={method} info={info} tx={tx}
                verifying={verifying}
                onComplete={completePayment} onCancel={cancelPayment}
                onChangeMethod={() => setStep("select")}
              />
              <OrderSummary info={info} compact />
            </motion.div>
          )}

          {step === "success" && completedTx && (
            <SuccessScreen tx={completedTx} info={info} />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

/* ───────────────────────── Step indicator ───────────────────────── */

function StepIndicator({ step }: { step: Step }) {
  const items: { id: Step; label: string }[] = [
    { id: "select", label: "Method" },
    { id: "pay", label: "Payment" },
    { id: "success", label: "Done" },
  ];
  const idx = items.findIndex((i) => i.id === step);
  return (
    <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 pt-8 pb-6">
      {items.map((it, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={it.id} className="flex flex-1 items-center gap-3">
            <div className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition",
              done ? "bg-primary text-primary-foreground" :
              active ? "bg-gradient-primary text-primary-foreground shadow-glow" :
              "bg-muted text-muted-foreground",
            )}>
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={cn("text-sm font-medium", active ? "text-foreground" : "text-muted-foreground")}>
              {it.label}
            </span>
            {i < items.length - 1 && (
              <div className="mx-2 h-px flex-1 bg-border">
                <motion.div
                  initial={{ width: 0 }} animate={{ width: done ? "100%" : "0%" }}
                  className="h-full bg-primary"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────── Order summary ───────────────────────── */

function OrderSummary({ info, cta, compact }: {
  info: typeof PLAN_INFO[PlanId]; cta?: React.ReactNode; compact?: boolean;
}) {
  return (
    <motion.aside
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
      className="h-fit rounded-3xl border border-border bg-card p-6 shadow-soft"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-bold">Order summary</h2>
      </div>
      <div className="mt-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">SolveX Pro</p>
        <p className="mt-1 text-sm font-semibold">{info.name}</p>
        <p className="text-xs text-muted-foreground">Billed per {info.period}</p>
        <p className="mt-3 font-display text-3xl font-bold tracking-tight">{info.price}</p>
      </div>

      {!compact && (
        <ul className="mt-4 space-y-2">
          {info.perks.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {p}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 space-y-2 text-sm">
        <Row label="Subtotal" value={info.price} muted />
        <Row label="Tax" value="Rp 0" muted />
        <div className="my-2 h-px bg-border" />
        <Row label="Total" value={info.price} bold />
      </div>

      {cta}

      <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
        <Lock className="h-3 w-3" /> 256-bit secured demo checkout
      </div>
    </motion.aside>
  );
}

function Row({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <div className={cn("flex justify-between",
      muted && "text-muted-foreground", bold && "font-display text-base font-bold")}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

/* ───────────────────────── Payment screen ───────────────────────── */

function PaymentInstructions({ method, info, tx, verifying, onComplete, onCancel, onChangeMethod }: {
  method: Method; info: typeof PLAN_INFO[PlanId];
  tx: { id: string; reference: string };
  verifying: boolean;
  onComplete: () => void; onCancel: () => void; onChangeMethod: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(5 * 60);
  useEffect(() => {
    if (verifying) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [verifying]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const expired = secondsLeft === 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PaymentMethodIcon method={method.id} />
          <div>
            <h2 className="font-display text-xl font-bold">Pay with {method.name}</h2>
            <p className="text-xs text-muted-foreground">Reference: {tx.reference}</p>
          </div>
        </div>
        <button onClick={onChangeMethod} className="text-xs font-medium text-primary hover:underline">
          Change method
        </button>
      </div>

      {/* Countdown */}
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">Complete payment within</span>
        </div>
        <span className={cn("font-display text-lg font-bold tabular-nums",
          expired ? "text-destructive" : "text-primary")}>
          {mm}:{ss}
        </span>
      </div>

      {/* Method body */}
      <div className="mt-6">
        {method.kind === "qr" && <QrBody info={info} tx={tx} />}
        {method.kind === "wallet" && <WalletBody method={method} info={info} tx={tx} />}
        {method.kind === "va" && <VaBody method={method} info={info} />}
        {method.kind === "card" && <CardBody />}
      </div>

      {/* Status */}
      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm">
        {verifying ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="font-medium">Checking payment status</span>
            <DotPulse />
          </>
        ) : (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <span className="font-medium">Waiting for payment</span>
            <DotPulse />
            <span className="ml-auto text-xs text-muted-foreground">{info.price}</span>
          </>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={onComplete} disabled={verifying || expired}
          className="flex-1 rounded-xl bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
        >
          {verifying ? "Verifying…" : "I've completed payment"}
        </Button>
        <Button onClick={onCancel} variant="outline" disabled={verifying} className="rounded-xl">
          <XIcon className="mr-2 h-4 w-4" /> Cancel payment
        </Button>
      </div>
    </motion.section>
  );
}

function DotPulse() {
  return (
    <span className="inline-flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
          className="text-muted-foreground"
        >.</motion.span>
      ))}
    </span>
  );
}

function QrBody({ info, tx }: { info: typeof PLAN_INFO[PlanId]; tx: { reference: string } }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent p-6">
      <FakeQR value={tx.reference} size={208} />
      <div className="text-center">
        <p className="text-xs text-muted-foreground">Scan with any QRIS-supported app</p>
        <p className="mt-1 font-display text-lg font-bold">{info.price}</p>
        <p className="text-[11px] text-muted-foreground">Merchant: SolveX (Demo)</p>
      </div>
    </div>
  );
}

function WalletBody({ method, info, tx }: { method: Method; info: typeof PLAN_INFO[PlanId]; tx: { reference: string } }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent p-6">
        <FakeQR value={`${method.id}:${tx.reference}`} size={184} />
        <p className="text-xs text-muted-foreground">Open your {method.name} app and scan the code</p>
      </div>
      <div className="rounded-2xl border border-border bg-background p-4 text-sm">
        <p className="font-semibold">How to pay</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Open the {method.name} app on your phone.</li>
          <li>Tap "Scan / Pay" and scan the QR code above.</li>
          <li>Confirm the amount {info.price} and complete payment.</li>
          <li>Come back here and tap "I've completed payment".</li>
        </ol>
      </div>
    </div>
  );
}

function VaBody({ method, info }: { method: Method; info: typeof PLAN_INFO[PlanId] }) {
  const va = useMemo(() =>
    method.id === "bca" ? "0123 9988 7766 5544"
    : method.id === "mandiri" ? "8950 4412 3344 5566"
    : "988 0011 22 334455", [method.id]);
  const copy = () => { navigator.clipboard.writeText(va.replace(/\s/g, "")); toast.success("VA number copied"); };
  const copyAmt = () => { navigator.clipboard.writeText(String(info.amount)); toast.success("Amount copied"); };
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-background p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{method.name}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-display text-xl font-bold tracking-wider tabular-nums">{va}</span>
          <Button onClick={copy} variant="outline" size="sm" className="rounded-full">
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
          </Button>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-background p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Amount</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-display text-xl font-bold">{info.price}</span>
          <Button onClick={copyAmt} variant="outline" size="sm" className="rounded-full">
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Transfer the exact amount to the Virtual Account above from your {method.name.replace(" Virtual Account", "")} mobile banking.
      </p>
    </div>
  );
}

function CardBody() {
  const [num, setNum] = useState("");
  const [name, setName] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#1E3A8A] p-5 text-white shadow-soft">
        <p className="text-xs uppercase tracking-widest opacity-70">SolveX · Premium</p>
        <p className="mt-6 font-display text-lg tracking-widest tabular-nums">
          {(num || "•••• •••• •••• ••••").padEnd(19, "•")}
        </p>
        <div className="mt-4 flex justify-between text-xs">
          <div><p className="opacity-60">Cardholder</p><p className="font-semibold">{name || "FULL NAME"}</p></div>
          <div><p className="opacity-60">Expires</p><p className="font-semibold">{exp || "MM/YY"}</p></div>
        </div>
      </div>
      <div className="grid gap-3">
        <Input placeholder="Card number" value={num} onChange={(e) => setNum(formatCard(e.target.value))}
          inputMode="numeric" maxLength={19} className="h-11 rounded-xl" />
        <Input placeholder="Cardholder name" value={name} onChange={(e) => setName(e.target.value.toUpperCase())} className="h-11 rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="MM/YY" value={exp} onChange={(e) => setExp(formatExp(e.target.value))} maxLength={5} className="h-11 rounded-xl" />
          <Input placeholder="CVC" value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4} className="h-11 rounded-xl" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Demo only — no real charge is made.</p>
    </div>
  );
}

function formatCard(v: string) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
function formatExp(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length < 3 ? d : d.slice(0, 2) + "/" + d.slice(2);
}

/* ───────────────────────── Success ───────────────────────── */

function SuccessScreen({ tx, info }: {
  tx: { reference: string; method: string; amount: number };
  info: typeof PLAN_INFO[PlanId];
}) {
  const nav = useNavigate();
  const methodName = METHODS.find((m) => m.id === tx.method)?.name ?? tx.method;
  return (
    <motion.div
      key="success"
      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
      className="mx-auto max-w-xl"
    >
      <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
        <motion.div
          initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 14 }}
          className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow"
        >
          <CheckCircle2 className="h-10 w-10" />
        </motion.div>
        <h1 className="mt-5 font-display text-2xl font-bold">Payment successful</h1>
        <p className="mt-1 text-sm text-muted-foreground">Welcome to SolveX Pro — let's solve something hard.</p>

        <div className="mt-6 space-y-2 rounded-2xl border border-border bg-background p-5 text-left text-sm">
          <DetailRow icon={<Receipt className="h-4 w-4" />} label="Transaction ID" value={tx.reference} mono />
          <DetailRow icon={<RefreshCw className="h-4 w-4" />} label="Plan" value={info.name} />
          <DetailRow label="Payment method" value={methodName} />
          <DetailRow label="Amount paid" value={`Rp ${tx.amount.toLocaleString("id-ID")}`} bold />
          <DetailRow label="Date" value={new Date().toLocaleString("id-ID")} />
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={() => nav({ to: "/chat" })}
            className="flex-1 rounded-xl bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
          >
            <Sparkles className="mr-2 h-4 w-4" /> Start solving
          </Button>
          <Button onClick={() => nav({ to: "/settings" })} variant="outline" className="flex-1 rounded-xl">
            View subscription
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function DetailRow({ icon, label, value, bold, mono }: {
  icon?: React.ReactNode; label: string; value: string; bold?: boolean; mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-muted-foreground">{icon}{label}</span>
      <span className={cn(bold && "font-bold", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}
