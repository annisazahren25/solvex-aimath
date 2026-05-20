import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const FREE_MSG_LIMIT = 15;
export const FREE_DAILY_UPLOAD_LIMIT = 5;

export const getDailyMessageCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "user")
      .gte("created_at", start.toISOString());
    return { count: count ?? 0 };
  });

export const getSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    let { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!sub) {
      const { data: inserted } = await supabase
        .from("subscriptions")
        .insert({ user_id: userId, plan: "free", status: "active" })
        .select("*")
        .single();
      sub = inserted;
    }
    const isPro =
      !!sub &&
      sub.plan !== "free" &&
      (sub.status === "active" || sub.status === "trialing") &&
      (!sub.current_period_end || new Date(sub.current_period_end) > new Date());
    return { subscription: sub, isPro };
  });

const dayInput = z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

export const getUsageToday = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { day?: string } | undefined) => dayInput.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const args: { _uid: string; _day?: string } = { _uid: userId };
    if (data.day) args._day = data.day;
    const { data: usage } = await supabase.rpc("get_or_create_usage_today", args);
    const { data: stats } = await supabase
      .from("usage_stats")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return { usage, stats: stats ?? { questions_solved: 0, total_ads_watched: 0 } };
  });

export const incrementImageUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { day?: string } | undefined) => dayInput.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const args: { _uid: string; _day?: string } = { _uid: userId };
    if (data.day) args._day = data.day;
    const { data: row, error } = await supabase.rpc("increment_image_upload", args);
    if (error) throw new Error(error.message);
    return row;
  });

export const addBonusUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { day?: string } | undefined) => dayInput.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const args: { _uid: string; _day?: string } = { _uid: userId };
    if (data.day) args._day = data.day;
    const { data: row, error } = await supabase.rpc("add_bonus_upload", args);
    if (error) throw new Error(error.message);
    return row;
  });

export const recordAdWatched = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { day?: string } | undefined) => dayInput.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const args: { _uid: string; _day?: string } = { _uid: userId };
    if (data.day) args._day = data.day;
    const { data: row, error } = await supabase.rpc("increment_ads_watched", args);
    if (error) throw new Error(error.message);
    return row;
  });

export const unlockMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messageId: string }) =>
    z.object({ messageId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("messages")
      .update({ is_locked: false })
      .eq("id", data.messageId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    await supabase.rpc("increment_ads_watched", { _uid: userId });
    return { ok: true };
  });

// Returns true if the user already reached the free message cap on their most
// recent thread. The newly created thread will be marked pending-ad and its
// first assistant response will be locked behind a rewarded ad.
export const createThreadSmart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isProRow } = await supabase.rpc("has_pro", { _uid: userId });
    const isPro = !!isProRow;

    let requiresAd = false;
    if (!isPro) {
      // Look at the most recent thread that actually has messages — ignore
      // empty placeholder threads the user may have opened but never used.
      const { data: latest } = await supabase
        .from("threads")
        .select("id, message_count")
        .gt("message_count", 0)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest && (latest.message_count ?? 0) >= FREE_MSG_LIMIT) {
        requiresAd = true;
      }
    }

    const { data: row, error } = await supabase
      .from("threads")
      .insert({
        user_id: userId,
        title: "New chat",
        is_locked_pending_ad: requiresAd,
      })
      .select("id, title, updated_at, created_at, is_locked_pending_ad")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getThreadState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string }) =>
    z.object({ threadId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: t } = await supabase
      .from("threads")
      .select("id, message_count, is_locked_pending_ad")
      .eq("id", data.threadId)
      .maybeSingle();
    return t;
  });

export const unlockThreadPendingAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string }) =>
    z.object({ threadId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Keep the thread flagged so every future answer also requires an ad.
    // We only record that one more ad was watched.
    void data;
    await supabase.rpc("increment_ads_watched", { _uid: userId });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Transactions (multi-step simulated checkout)
// ---------------------------------------------------------------------------

export const createTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    plan: "pro_weekly" | "pro_monthly" | "pro_yearly";
    method: string;
    amount: number;
  }) =>
    z.object({
      plan: z.enum(["pro_weekly", "pro_monthly", "pro_yearly"]),
      method: z.string().min(1).max(40),
      amount: z.number().int().min(1).max(100_000_000),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const ref = "SVX-" + Date.now().toString(36).toUpperCase() +
      "-" + Math.random().toString(36).slice(2, 7).toUpperCase();
    const { data: row, error } = await supabase
      .from("payment_transactions")
      .insert({
        user_id: userId, reference: ref, plan: data.plan,
        method: data.method, amount: data.amount, status: "pending",
      })
      .select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const confirmTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { transactionId: string }) =>
    z.object({ transactionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: tx, error: txErr } = await supabase
      .from("payment_transactions")
      .select("*").eq("id", data.transactionId).eq("user_id", userId).maybeSingle();
    if (txErr) throw new Error(txErr.message);
    if (!tx) throw new Error("Transaction not found");

    const plan = tx.plan as "pro_weekly" | "pro_monthly" | "pro_yearly";
    const days = plan === "pro_weekly" ? 7 : plan === "pro_monthly" ? 30 : 365;
    const periodEnd = new Date(Date.now() + days * 86_400_000).toISOString();

    await supabase.from("payment_transactions").update({
      status: "success",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", tx.id);

    const { data: existing } = await supabase
      .from("subscriptions").select("id").eq("user_id", userId).maybeSingle();
    if (existing) {
      await supabase.from("subscriptions").update({
        plan, status: "active", current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      }).eq("user_id", userId);
    } else {
      await supabase.from("subscriptions").insert({
        user_id: userId, plan, status: "active", current_period_end: periodEnd,
      });
    }
    return { ok: true, transaction: { ...tx, status: "success", completed_at: new Date().toISOString() } };
  });

export const cancelTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { transactionId: string }) =>
    z.object({ transactionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await supabase.from("payment_transactions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", data.transactionId).eq("user_id", userId);
    return { ok: true };
  });

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("payment_transactions").select("*")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
    return { transactions: data ?? [] };
  });

// DUMMY checkout — simulates a successful Stripe payment by upserting a Pro
// subscription row. Replace with real Stripe webhook handling later.
export const dummyUpgrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan: "pro_weekly" | "pro_monthly" | "pro_yearly" }) =>
    z.object({ plan: z.enum(["pro_weekly", "pro_monthly", "pro_yearly"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const days = data.plan === "pro_weekly" ? 7 : data.plan === "pro_monthly" ? 30 : 365;
    const periodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("subscriptions")
        .update({
          plan: data.plan,
          status: "active",
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("subscriptions").insert({
        user_id: userId,
        plan: data.plan,
        status: "active",
        current_period_end: periodEnd,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("subscriptions")
      .update({
        plan: "free",
        status: "active",
        current_period_end: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
