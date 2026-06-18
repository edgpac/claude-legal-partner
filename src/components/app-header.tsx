import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, FileText, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export function AppHeader() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/60 sticky top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold">
            L
          </div>
          <span className="font-semibold tracking-tight">
            Legal<span className="text-primary">Claude</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className="px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors data-[status=active]:text-foreground data-[status=active]:bg-accent"
          >
            <span className="inline-flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> Upload
            </span>
          </Link>
          <Link
            to="/history"
            className="px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors data-[status=active]:text-foreground data-[status=active]:bg-accent"
          >
            <span className="inline-flex items-center gap-1.5">
              <History className="h-4 w-4" /> History
            </span>
          </Link>
          <button
            onClick={signOut}
            className="ml-2 px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors inline-flex items-center gap-1.5"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
