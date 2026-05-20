import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check, Sparkles, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/solvex/logo";
import { useAuth } from "@/lib/auth-context";
import { useSubscription } from "@/hooks/use-subscription";
import { PlanBadge } from "@/components/solvex/plan-badge";
import { AnimatedBackground } from "@/components/solvex/animated-background";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "SolveX Pro — Unlock unlimited math solving" },
      {
        name: "description",
        content:
          "Upgrade to SolveX Pro for unlimited chats, unlimited image uploads, no ads, and faster AI responses.",
      },
      { property: "og:title", content: "SolveX Pro — Unlock unlimited math solving" },
      {
        property: "og:description",
        content:
          "Upgrade to SolveX Pro for unlimited chats, unlimited image uploads, no ads, and faster AI responses.",
      },
    ],
  }),
  component: PricingPage,
});

type Plan = {
  id: "pro_weekly" | "pro_monthly" | "pro_yearly";
  name: string;
  price: string;
  period: string;
  tagline: string;
  highlight?: string;
  popular?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "pro_weekly",
    name: "Weekly",
    price: "Rp 19.000",
    period: "/week",
    tagline: "Try Pro this week",
  },
  {
    id: "pro_monthly",
    name: "Monthly",
    price: "Rp 49.000",
    period: "/month",
    tagline: "Best for regular study",
    popular: true,
  },
  {
    id: "pro_yearly",
    name: "Yearly",
    price: "Rp 299.000",
    period: "/year",
    tagline: "12 months, one payment",
    highlight: "Save 50%",
  },
];

function PricingPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { isPro } = useSubscription();

  const handleCheckout = (plan: Plan) => {
    if (!user) {
      nav({ to: "/login" });
      return;
    }
    nav({ to: "/checkout", search: { plan: plan.id } });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-soft">
      <AnimatedBackground variant="soft" />
      <header className="relative z-10 flex items-center justify-between border-b border-border bg-card/70 px-6 py-4 backdrop-blur">
        <Link to="/"><Logo /></Link>
        <div className="flex items-center gap-3">
          {user && <PlanBadge isPro={isPro} />}
          <Button asChild variant="ghost" className="rounded-full">
            <Link to={user ? "/chat" : "/"}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" /> SolveX Pro
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Solve smarter, learn faster.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Unlimited chats, unlimited image solving, zero ads.
            Built for students who never want to be stuck on a problem again.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PLANS.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -4 }}
              className={
                p.popular
                  ? "relative rounded-3xl border-2 border-primary bg-card p-6 shadow-glow"
                  : "relative rounded-3xl border border-border bg-card p-6 shadow-soft transition hover:border-primary/40 hover:shadow-glow"
              }
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-glow">
                  Most Popular
                </span>
              )}
              {p.highlight && !p.popular && (
                <span className="absolute right-4 top-4 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  {p.highlight}
                </span>
              )}
              <h3 className="font-display text-lg font-bold">{p.name}</h3>
              <p className="text-sm text-muted-foreground">{p.tagline}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold tracking-tight">{p.price}</span>
                <span className="text-sm text-muted-foreground">{p.period}</span>
              </div>
              <Button
                onClick={() => handleCheckout(p)}
                disabled={isPro}
                className={
                  p.popular
                    ? "mt-5 w-full rounded-xl bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                    : "mt-5 w-full rounded-xl"
                }
                variant={p.popular ? "default" : "outline"}
              >
                {isPro ? "You're on Pro" : `Upgrade to ${p.name}`}
              </Button>
              <ul className="mt-6 space-y-2">
                {PRO_FEATURES.slice(0, 6).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <div className="mt-20">
          <h2 className="text-center font-display text-2xl font-bold tracking-tight">
            Free vs Pro
          </h2>
          <div className="mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-left">
                  <th className="px-5 py-4 font-semibold">Feature</th>
                  <th className="px-5 py-4 text-center font-semibold">Free</th>
                  <th className="px-5 py-4 text-center font-semibold text-primary">Pro</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row, idx) => (
                  <tr key={row.label} className={idx % 2 === 0 ? "bg-background/40" : ""}>
                    <td className="px-5 py-3 font-medium">{row.label}</td>
                    <td className="px-5 py-3 text-center text-muted-foreground">
                      {row.free === true ? <Check className="mx-auto h-4 w-4 text-muted-foreground" />
                        : row.free === false ? <X className="mx-auto h-4 w-4 text-muted-foreground/60" />
                        : row.free}
                    </td>
                    <td className="px-5 py-3 text-center font-semibold text-primary">
                      {row.pro === true ? <Check className="mx-auto h-4 w-4 text-primary" />
                        : row.pro === false ? <X className="mx-auto h-4 w-4" />
                        : row.pro}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Cancel anytime. Prices in IDR. Taxes may apply.
        </p>
      </main>
    </div>
  );
}

const PRO_FEATURES = [
  "Unlimited chat messages",
  "Unlimited image uploads",
  "No ads — ever",
  "Faster AI responses",
  "Advanced step-by-step explanations",
  "Better OCR accuracy",
  "Unlimited chat history",
  "Advanced graph visualization",
  "Priority processing",
];

type Row = { label: string; free: string | boolean; pro: string | boolean };
const COMPARE: Row[] = [
  { label: "Messages per chat", free: "15", pro: "Unlimited" },
  { label: "Daily image uploads", free: "5", pro: "Unlimited" },
  { label: "Ads", free: "Rewarded", pro: false },
  { label: "Step-by-step solutions", free: true, pro: true },
  { label: "Advanced explanations", free: false, pro: true },
  { label: "Priority AI response", free: false, pro: true },
  { label: "Chat history", free: "Limited", pro: "Unlimited" },
  { label: "Graph visualization", free: "Basic", pro: "Advanced" },
];
