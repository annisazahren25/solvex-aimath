import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { createThreadSmart } from "@/lib/subscription.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/chat/")({ component: NewChat });

function NewChat() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createThreadSmart);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        await supabase.auth.getSession();
        const thread = await create();
        qc.invalidateQueries({ queryKey: ["threads"] });
        nav({ to: "/chat/$threadId", params: { threadId: thread.id }, replace: true });
      } catch (e) {
        started.current = false;
        console.error(e);
      }
    })();
  }, [create, nav, qc]);

  return (
    <div className="grid h-full place-items-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
