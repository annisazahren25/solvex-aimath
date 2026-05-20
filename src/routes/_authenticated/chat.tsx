import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/solvex/sidebar";

export const Route = createFileRoute("/_authenticated/chat")({ component: ChatLayout });

function ChatLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative flex h-screen w-full bg-background">
      <Sidebar open={sidebarOpen} />
      <main className="relative flex-1 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-3 top-3 z-10 rounded-lg"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
        </Button>
        <Outlet />
      </main>
    </div>
  );
}
