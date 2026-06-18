import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { RiskBadge } from "@/components/risk-badge";
import { listRecentReviews } from "@/lib/review.functions";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const list = useServerFn(listRecentReviews);
  const q = useQuery({ queryKey: ["recent-reviews"], queryFn: () => list() });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="tracking-tight">History</h1>
        <p className="mt-1 text-sm text-muted-foreground">All your past reviews.</p>

        <div className="mt-6 rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
          {q.isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : !q.data || q.data.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No reviews yet</p>
              <Link to="/" className="mt-3 inline-block text-sm text-primary font-medium hover:underline">
                Upload a contract
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-surface-alt">
                  <th className="px-5 py-3 font-medium">Document</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {q.data.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-alt transition-colors">
                    <td className="px-5 py-3">
                      <Link
                        to="/review/$id"
                        params={{ id: r.id }}
                        className="font-medium hover:text-primary"
                      >
                        {r.documents?.filename ?? "Untitled"}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      {r.status === "processing" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing
                        </span>
                      ) : r.status === "error" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-risk-high">
                          <ShieldAlert className="h-3.5 w-3.5" /> Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-risk-low">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {r.overall_risk ? (
                        <RiskBadge level={r.overall_risk as "high" | "medium" | "low"} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
