import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/solvex/logo";
import { TransactionHistory } from "@/components/solvex/transaction-history";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { updateProfile } from "@/lib/chat.functions";
import { cancelSubscription } from "@/lib/subscription.functions";
import { useSubscription } from "@/hooks/use-subscription";
import { PlanBadge } from "@/components/solvex/plan-badge";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({ component: Settings });

function Settings() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const up = useServerFn(updateProfile);
  const cancelSub = useServerFn(cancelSubscription);
  const qc = useQueryClient();
  const { isPro, plan, refetch } = useSubscription();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await up({ data: { full_name: name } });
      toast.success("Profile updated");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const deleteAccount = async () => {
    if (!confirm("This will sign you out and remove your saved chats. Continue?")) return;
    // Delete user-owned rows; auth user deletion requires admin and is out of scope.
    await supabase.from("threads").delete().eq("user_id", user!.id);
    await signOut();
    nav({ to: "/" });
  };

  const cancel = async () => {
    if (!confirm("Cancel your Pro subscription and switch to Free?")) return;
    try {
      await cancelSub();
      qc.invalidateQueries();
      refetch();
      toast.success("Subscription cancelled. You're now on Free.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <Link to="/chat"><Logo /></Link>
        <Button asChild variant="ghost" className="rounded-full"><Link to="/chat"><ArrowLeft className="mr-2 h-4 w-4" />Back to chat</Link></Button>
      </header>
      <main className="mx-auto max-w-2xl space-y-6 px-6 py-10">
        <Section title="Subscription">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <PlanBadge isPro={isPro} size="md" />
                <span className="text-sm text-muted-foreground">{plan}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {isPro
                  ? "Thanks for supporting SolveX. You have unlimited access."
                  : "Upgrade to unlock unlimited messaging, uploads, and ad-free study."}
              </p>
            </div>
            {isPro ? (
              <Button onClick={cancel} variant="outline" className="rounded-xl">
                Cancel plan
              </Button>
            ) : (
              <Button asChild className="rounded-xl bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                <Link to="/pricing">Upgrade to Pro</Link>
              </Button>
            )}
          </div>
        </Section>
        <Section title="Account">
          <div className="space-y-3">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled className="h-11 rounded-xl" />
            <Label>Display name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="h-11 rounded-xl" />
            <Button onClick={save} disabled={saving} className="rounded-xl bg-gradient-primary text-primary-foreground">Save changes</Button>
          </div>
        </Section>
        <Section title="Appearance">
          <p className="text-sm text-muted-foreground">SolveX uses a clean light theme tuned for long study sessions.</p>
        </Section>
        <Section title="AI preferences">
          <p className="text-sm text-muted-foreground">Powered by Lovable AI · Gemini 2.5 Flash. Step-by-step LaTeX answers enabled.</p>
        </Section>
        <Section title="Billing history">
          <TransactionHistory />
        </Section>
        <Section title="Danger zone" tone="danger">
          <p className="text-sm text-muted-foreground">Permanently delete all of your saved chats.</p>
          <Button onClick={deleteAccount} variant="destructive" className="mt-3 rounded-xl">Delete my data</Button>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children, tone }: { title: string; children: React.ReactNode; tone?: "danger" }) {
  return (
    <div className={`rounded-3xl border bg-card p-6 shadow-soft ${tone === "danger" ? "border-destructive/30" : "border-border"}`}>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}
