import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { MessageContent } from "./message-content";
import { Composer, type ComposerAttachment } from "./composer";
import { Logo } from "./logo";
import { LockedAnswerCard } from "./upgrade-card";
import { UploadLimitModal } from "./upload-limit-modal";
import { AdModal } from "./ad-modal";
import { useSubscription } from "@/hooks/use-subscription";
import {
  FREE_MSG_LIMIT,
  incrementImageUpload,
  addBonusUpload,
  unlockThreadPendingAd,
} from "@/lib/subscription.functions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ModeSelector, ActiveModeBadge, type ExplanationMode } from "./mode-selector";

const MODE_KEY = "solvex:explanation-mode";

export function ChatWindow({
  threadId,
  initialMessages,
  initialIsLocked = false,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  initialIsLocked?: boolean;
}) {
  const { isPro, uploadsLeft, refetchUsage, dailyMsgCount, refetchDailyMsg } =
    useSubscription();
  const incUpload = useServerFn(incrementImageUpload);
  const addBonus = useServerFn(addBonusUpload);
  const unlockThread = useServerFn(unlockThreadPendingAd);

  const [threadLocked] = useState(initialIsLocked);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [localSentToday, setLocalSentToday] = useState(0);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadModalVariant, setUploadModalVariant] = useState<"denied" | "reached">("denied");
  const [uploadAd, setUploadAd] = useState(false);
  const [unlockAdFor, setUnlockAdFor] = useState<string | null>(null);

  const [mode, setMode] = useState<ExplanationMode>(() => {
    if (typeof window === "undefined") return "simple";
    const saved = window.localStorage.getItem(MODE_KEY) as ExplanationMode | null;
    return saved ?? "simple";
  });
  const modeRef = useRef<ExplanationMode>(mode);
  useEffect(() => {
    modeRef.current = mode;
    if (typeof window !== "undefined") window.localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  const transport = new DefaultChatTransport({
    api: "/api/chat",
    fetch: async (url, init) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers = new Headers(init?.headers);
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return fetch(url, { ...init, headers });
    },
    prepareSendMessagesRequest: ({ messages }) => ({
      body: { messages, threadId, mode: modeRef.current },
    }),
  });

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => toast.error(e.message || "Something went wrong"),
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const handleSubmit = (text: string, attachments: ComposerAttachment[]) => {
    // Track uploads server-side (best-effort)
    if (!isPro && attachments.length > 0) {
      const d = new Date();
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      Promise.all(attachments.map(() => incUpload({ data: { day } }))).finally(() => refetchUsage());
      // If this batch consumed the remaining uploads, surface the limit modal
      // right after the message is sent so the user immediately sees the next step.
      if (
        Number.isFinite(uploadsLeft) &&
        attachments.length >= (uploadsLeft as number)
      ) {
        setTimeout(() => {
          setUploadModalVariant("reached");
          setUploadModal(true);
        }, 1200);
      }
    }
    setLocalSentToday((n) => n + 1);
    // Refresh authoritative daily count shortly after the user message lands.
    setTimeout(() => refetchDailyMsg(), 1500);
    sendMessage({
      role: "user",
      parts: [
        ...(text ? [{ type: "text" as const, text }] : []),
        ...attachments.map((a) => ({
          type: "file" as const,
          url: a.url,
          mediaType: a.mediaType,
          filename: a.filename,
        })),
      ],
    });
  };

  useEffect(() => {
    const key = `solvex:autosend:${threadId}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    sessionStorage.removeItem(key);
    try {
      const payload = JSON.parse(raw) as { text: string; attachments: ComposerAttachment[] };
      handleSubmit(payload.text, payload.attachments ?? []);
    } catch {
      toast.error("Could not send the pending message.");
    }
  }, [threadId]);

  const isEmpty = messages.length === 0;
  const busy = status === "submitted" || status === "streaming";

  // Daily-scoped gate: once the free user hits their daily message cap,
  // EVERY subsequent question (in this thread OR a brand-new one) is gated
  // by an ad or Pro upgrade.
  const effectiveDailyCount = Math.max(dailyMsgCount, localSentToday);
  const overFreeLimit = !isPro && effectiveDailyCount > FREE_MSG_LIMIT;

  // Mark every assistant reply produced while the gate is active as locked,
  // so previous answers stay blurred when a new question arrives without an ad.
  const gateActive = !isPro && (threadLocked || overFreeLimit);
  useEffect(() => {
    if (!gateActive) return;
    if (status !== "ready") return;
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;
    setLockedIds((prev) => {
      if (prev.has(lastAssistant.id) || unlockedIds.has(lastAssistant.id)) return prev;
      const next = new Set(prev);
      next.add(lastAssistant.id);
      return next;
    });
  }, [messages, status, gateActive, unlockedIds]);

  const isLocked = (id: string) => lockedIds.has(id) && !unlockedIds.has(id);

  const handleUnlockAdComplete = async () => {
    const targetId = unlockAdFor;
    if (!targetId) return;
    try {
      await unlockThread({ data: { threadId } });
      // Only reveal the specific bubble the user chose to unlock.
      setUnlockedIds((prev) => {
        const next = new Set(prev);
        next.add(targetId);
        return next;
      });
      setUnlockAdFor(null);
      toast.success("Answer unlocked!");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const handleUploadAdComplete = async () => {
    try {
      const d = new Date();
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      await addBonus({ data: { day } });
      refetchUsage();
      setUploadAd(false);
      toast.success("+1 upload added for today");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-6 text-center">
            <Logo withText={false} className="scale-150" />
            <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">
              How can I help you solve today?
            </h1>
            <p className="mt-2 text-muted-foreground">
              Type a problem, upload an image, or snap a photo of your equation.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={m.role === "user" ? "flex justify-end" : "flex gap-3"}
                >
                  {m.role === "assistant" && (
                    <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-primary text-sm font-bold text-primary-foreground">
                      ∑
                    </div>
                  )}
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[80%] rounded-3xl rounded-br-md bg-gradient-primary px-5 py-3 text-primary-foreground shadow-soft"
                        : "min-w-0 flex-1"
                    }
                  >
                    {m.role === "user" ? (
                      <UserParts message={m} />
                    ) : (
                      <>
                        <div
                          className={cn(
                            isLocked(m.id)
                              ? "pointer-events-none select-none blur-md"
                              : "",
                          )}
                        >
                          <AssistantParts message={m} />
                        </div>
                        {isLocked(m.id) && (
                          <LockedAnswerCard onWatchAd={() => setUnlockAdFor(m.id)} />
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {status === "submitted" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="mt-1 grid h-8 w-8 place-items-center rounded-full bg-gradient-primary text-sm font-bold text-primary-foreground">
                  ∑
                </div>
                <div className="flex items-center gap-1 pt-2">
                  <Dot delay={0} />
                  <Dot delay={0.15} />
                  <Dot delay={0.3} />
                </div>
              </motion.div>
            )}
            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error.message}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="border-t border-border bg-background/60 backdrop-blur">
        <Composer
          onSubmit={handleSubmit}
          disabled={busy}
          status={status}
          uploadsLeft={uploadsLeft}
          onUploadDenied={() => {
            setUploadModalVariant("denied");
            setUploadModal(true);
          }}
        />
      </div>
      <UploadLimitModal
        open={uploadModal}
        onClose={() => setUploadModal(false)}
        variant={uploadModalVariant}
      />
      <AdModal
        open={uploadAd}
        onClose={() => setUploadAd(false)}
        onComplete={handleUploadAdComplete}
        title="Watch a short ad for +1 upload"
        subtitle="You'll get one extra image upload for today."
      />
      <AdModal
        open={!!unlockAdFor}
        onClose={() => setUnlockAdFor(null)}
        onComplete={handleUnlockAdComplete}
        title="Watch a short ad to reveal your answer"
        subtitle="Your step-by-step solution will appear right after."
      />
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="h-2 w-2 rounded-full bg-primary"
      animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
      transition={{ duration: 0.9, repeat: Infinity, delay }}
    />
  );
}

function UserParts({ message }: { message: UIMessage }) {
  return (
    <div className="space-y-2">
      {message.parts.map((p, i) => {
        if (p.type === "text") return <p key={i} className="whitespace-pre-wrap text-[15px]">{p.text}</p>;
        if (p.type === "file" && p.mediaType?.startsWith("image/"))
          return <img key={i} src={p.url} alt="upload" className="max-h-64 rounded-xl" />;
        return null;
      })}
    </div>
  );
}

function AssistantParts({ message }: { message: UIMessage }) {
  const text = message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("");
  const blocks = splitIntoBlocks(text);
  if (blocks.length <= 1) return <MessageContent>{text}</MessageContent>;
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: i * 0.04 }}
          className={
            b.kind === "answer"
              ? "rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 px-4 py-3 shadow-soft"
              : b.kind === "step"
              ? "rounded-2xl border border-border bg-card px-4 py-3 shadow-sm"
              : "rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-3"
          }
        >
          {b.label && (
            <div
              className={
                b.kind === "answer"
                  ? "mb-1 text-xs font-bold uppercase tracking-wider text-primary"
                  : b.kind === "step"
                  ? "mb-1 text-xs font-bold uppercase tracking-wider text-primary/80"
                  : "mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground"
              }
            >
              {b.label}
            </div>
          )}
          <MessageContent>{b.body}</MessageContent>
        </motion.div>
      ))}
    </div>
  );
}

type Block = { kind: "problem" | "step" | "answer" | "text"; label: string | null; body: string };

function splitIntoBlocks(text: string): Block[] {
  if (!text.trim()) return [];
  const regex = /\*\*(Problem(?:\s*\(from image\))?|Step\s*\d+|Answer)\s*:?\*\*\s*:?\s*/gi;
  const blocks: Block[] = [];
  let lastIndex = 0;
  let lastLabel: string | null = null;
  let lastKind: Block["kind"] = "text";
  const pushBlock = (end: number) => {
    const body = text.slice(lastIndex, end).trim();
    if (!body && !lastLabel) return;
    blocks.push({ kind: lastKind, label: lastLabel, body });
  };
  let m: RegExpExecArray | null;
  let firstMatch = true;
  while ((m = regex.exec(text)) !== null) {
    if (firstMatch) {
      const prefix = text.slice(0, m.index).trim();
      if (prefix) blocks.push({ kind: "text", label: null, body: prefix });
      firstMatch = false;
    } else {
      pushBlock(m.index);
    }
    const raw = m[1].toLowerCase();
    lastLabel = m[1].replace(/\s+/g, " ");
    lastKind = raw.startsWith("problem") ? "problem" : raw.startsWith("answer") ? "answer" : "step";
    lastIndex = m.index + m[0].length;
  }
  if (firstMatch) return [{ kind: "text", label: null, body: text }];
  pushBlock(text.length);
  return blocks;
}
