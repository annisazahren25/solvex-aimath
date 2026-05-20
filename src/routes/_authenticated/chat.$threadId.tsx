import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { UIMessage } from "ai";
import { getMessages } from "@/lib/chat.functions";
import { getThreadState } from "@/lib/subscription.functions";
import { ChatWindow } from "@/components/solvex/chat-window";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({ component: Thread });

function Thread() {
  const { threadId } = Route.useParams();
  const { user, session } = useAuth();
  const ready = !!user && !!session?.access_token;
  const fetchMessages = useServerFn(getMessages);
  const fetchThreadState = useServerFn(getThreadState);
  const { data, isLoading } = useQuery({
    queryKey: ["messages", threadId, user?.id],
    queryFn: () => fetchMessages({ data: { threadId } }),
    enabled: ready,
  });
  const { data: threadState } = useQuery({
    queryKey: ["thread-state", threadId, user?.id],
    queryFn: () => fetchThreadState({ data: { threadId } }),
    enabled: ready,
  });

  const initialMessages = useMemo<UIMessage[]>(() => {
    if (!data) return [];
    return data.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      parts: (m.parts as unknown as UIMessage["parts"]) ?? [],
    }));
  }, [data]);

  // Drain pending first-message handoff from /chat
  useEffect(() => {
    const key = `solvex:pending:${threadId}`;
    const raw = sessionStorage.getItem(key);
    if (!raw || !data) return;
    sessionStorage.removeItem(key);
    // The pending message will be sent by the ChatWindow via a quick post-mount effect.
    // Encode it back into sessionStorage with a sentinel the ChatWindow can read.
    sessionStorage.setItem(`solvex:autosend:${threadId}`, raw);
  }, [threadId, data]);

  if (isLoading) {
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  return (
    <ChatWindow
      key={threadId}
      threadId={threadId}
      initialMessages={initialMessages}
      initialIsLocked={!!threadState?.is_locked_pending_ad}
    />
  );
}
