import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getSubscription,
  getUsageToday,
  getDailyMessageCount,
  FREE_DAILY_UPLOAD_LIMIT,
} from "@/lib/subscription.functions";
import { useAuth } from "@/lib/auth-context";

function localDay() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function useSubscription() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const sub = useServerFn(getSubscription);
  const usage = useServerFn(getUsageToday);
  const dailyMsg = useServerFn(getDailyMessageCount);
  const day = localDay();

  const subQ = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: () => sub(),
    enabled: !!user,
    staleTime: 60_000,
  });

  const usageQ = useQuery({
    queryKey: ["usage-today", user?.id, day],
    queryFn: () => usage({ data: { day } }),
    enabled: !!user,
    staleTime: 30_000,
  });

  const dailyMsgQ = useQuery({
    queryKey: ["daily-msg-count", user?.id],
    queryFn: () => dailyMsg(),
    enabled: !!user,
    staleTime: 15_000,
  });

  const isPro = !!subQ.data?.isPro;
  const plan = subQ.data?.subscription?.plan ?? "free";
  const used = usageQ.data?.usage?.image_uploads ?? 0;
  const bonus = usageQ.data?.usage?.bonus_uploads ?? 0;
  const adsToday = usageQ.data?.usage?.ads_watched ?? 0;
  const uploadsAllowed = FREE_DAILY_UPLOAD_LIMIT + bonus;
  const uploadsLeft = isPro ? Infinity : Math.max(0, uploadsAllowed - used);
  const dailyMsgCount = dailyMsgQ.data?.count ?? 0;

  return {
    isPro,
    plan,
    used,
    bonus,
    adsToday,
    uploadsAllowed,
    uploadsLeft,
    dailyMsgCount,
    stats: usageQ.data?.stats,
    refetch: () => {
      qc.invalidateQueries({ queryKey: ["subscription"] });
      qc.invalidateQueries({ queryKey: ["usage-today"] });
      qc.invalidateQueries({ queryKey: ["daily-msg-count"] });
    },
    refetchUsage: () => qc.invalidateQueries({ queryKey: ["usage-today"] }),
    refetchDailyMsg: () => qc.invalidateQueries({ queryKey: ["daily-msg-count"] }),
  };
}
