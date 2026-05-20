import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Plus,
  Search,
  MessageSquare,
  Settings,
  User,
  LogOut,
  Trash2,
} from "lucide-react";
import { Logo } from "./logo";
import { PlanBadge } from "./plan-badge";
import { useSubscription } from "@/hooks/use-subscription";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listThreads, deleteThread } from "@/lib/chat.functions";
import { createThreadSmart } from "@/lib/subscription.functions";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function Sidebar({ open }: { open: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, signOut } = useAuth();
  const params = useParams({ strict: false }) as { threadId?: string };
  const [search, setSearch] = useState("");
  const list = useServerFn(listThreads);
  const create = useServerFn(createThreadSmart);
  const del = useServerFn(deleteThread);
  const { isPro } = useSubscription();

  const { data: threads = [] } = useQuery({
    queryKey: ["threads", user?.id],
    queryFn: () => list(),
    enabled: !!user,
  });

  const createMut = useMutation({
    mutationFn: () => create(),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      if (params.threadId === id) navigate({ to: "/chat" });
      toast.success("Chat deleted");
    },
  });

  const filtered = threads.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase())
  );

  const initial = user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-in-out",
        open ? "w-72" : "w-0 overflow-hidden border-none"
      )}
    >
      {/* Header */}
      <div className="flex items-center px-3 py-4">
        <Link to="/">
          <Logo />
        </Link>
      </div>

      {/* New chat button */}
      <div className="px-2">
        <Button
          onClick={() => createMut.mutate()}
          disabled={createMut.isPending}
          className="w-full justify-start gap-2 rounded-xl bg-gradient-primary text-primary-foreground shadow-soft hover:opacity-90"
          title="New chat"
        >
          <Plus className="h-4 w-4 shrink-0" />
          New chat
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats"
            className="rounded-xl border-border bg-muted/50 pl-9"
          />
        </div>
      </div>

      {/* Threads list */}
      <nav className="mt-3 flex-1 overflow-y-auto px-2 pb-2">
        <p className="px-2 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Recent
        </p>
        <ul className="space-y-1">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No chats yet
            </li>
          ) : (
            filtered.map((t) => {
              const active = params.threadId === t.id;
              return (
                <li key={t.id} className="group relative">
                  <Link
                    to="/chat/$threadId"
                    params={{ threadId: t.id }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground hover:bg-sidebar-accent"
                    )}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{t.title}</span>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      delMut.mutate(t.id);
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-background hover:text-destructive"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2">
        <div className="mb-2 flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-primary text-sm font-semibold text-primary-foreground">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.email}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <PlanBadge isPro={isPro} />
              {!isPro && (
                <Link
                  to="/pricing"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Upgrade
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="rounded-lg"
            title="Profile"
          >
            <Link to="/profile">
              <User className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="rounded-lg"
            title="Settings"
          >
            <Link to="/settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-lg"
            onClick={() => signOut()}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
