import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  FileText,
  ShieldAlert,
  ListChecks,
  Sparkles,
  Loader2,
  AlertOctagon,
  Gavel,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { RiskBadge, riskBorderClass } from "@/components/risk-badge";
import { getReview } from "@/lib/review.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/review/$id")({
  component: ReviewPage,
});

type Tab = "overview" | "clauses" | "risks" | "compliance" | "briefing";

type ReviewResult = {
  summary: string;
  documentType: string;
  overallRisk: "high" | "medium" | "low";
  clauses: Array<{
    title: string;
    extractedText: string;
    riskLevel: "high" | "medium" | "low" | "info";
    finding: string;
    recommendation: string;
  }>;
  missingClauses: string[];
  prohibitedTerms: string[];
  complianceIssues: string[];
  briefing: {
    headline: string;
    keyPoints: string[];
    topRisks: string[];
    recommendation: "sign" | "negotiate" | "reject" | "escalate";
    recommendationReason: string;
  };
};

function ReviewPage() {
  const { id } = Route.useParams();
  const fetchReview = useServerFn(getReview);
  const [tab, setTab] = useState<Tab>("overview");

  const q = useQuery({
    queryKey: ["review", id],
    queryFn: () => fetchReview({ data: { id } }),
    refetchInterval: (query) => {
      const status = (query.state.data as { status?: string } | undefined)?.status;
      return status === "processing" ? 2000 : false;
    },
  });

  if (q.isLoading) return <FullPageLoader />;
  if (q.isError || !q.data) throw notFound();

  const review = q.data;
  const doc = review.documents as { filename: string; file_type?: string; word_count?: number; page_count?: number } | null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <div className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to upload
          </Link>
          <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h1 className="truncate">{doc?.filename ?? "Untitled document"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {doc?.page_count ? `${doc.page_count} pages · ` : ""}
                {doc?.word_count ? `${doc.word_count.toLocaleString()} words · ` : ""}
                {new Date(review.created_at).toLocaleString()}
              </p>
            </div>
            {review.overall_risk && (
              <RiskBadge level={review.overall_risk as "high" | "medium" | "low"} />
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {review.status === "processing" ? (
          <ProcessingState />
        ) : review.status === "error" ? (
          <ErrorState message={review.error_message ?? "Review failed."} />
        ) : !review.result_json ? (
          <ErrorState message="No results available." />
        ) : (
          <Results result={review.result_json as ReviewResult} tab={tab} onTab={setTab} />
        )}
      </main>
    </div>
  );
}

function Results({ result, tab, onTab }: { result: ReviewResult; tab: Tab; onTab: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: typeof FileText; count?: number }[] = [
    { id: "overview", label: "Overview", icon: FileText },
    { id: "clauses", label: "Clauses", icon: ListChecks, count: result.clauses?.length },
    {
      id: "risks",
      label: "Risk flags",
      icon: ShieldAlert,
      count: result.clauses?.filter((c) => c.riskLevel === "high" || c.riskLevel === "medium").length,
    },
    {
      id: "compliance",
      label: "Compliance",
      icon: AlertOctagon,
      count: (result.complianceIssues?.length ?? 0) + (result.missingClauses?.length ?? 0),
    },
    { id: "briefing", label: "Briefing", icon: Sparkles },
  ];

  return (
    <div>
      <nav className="flex gap-1 border-b border-border overflow-x-auto -mx-1 px-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onTab(t.id)}
              className={cn(
                "shrink-0 inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {t.count != null && t.count > 0 && (
                <span
                  className={cn(
                    "text-xs rounded-full px-1.5 py-0.5",
                    active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-6">
        {tab === "overview" && <OverviewTab result={result} />}
        {tab === "clauses" && <ClausesTab clauses={result.clauses} />}
        {tab === "risks" && (
          <ClausesTab
            clauses={result.clauses?.filter((c) => c.riskLevel === "high" || c.riskLevel === "medium") ?? []}
            emptyLabel="No high or medium risks flagged."
          />
        )}
        {tab === "compliance" && <ComplianceTab result={result} />}
        {tab === "briefing" && <BriefingTab briefing={result.briefing} />}
      </div>
    </div>
  );
}

function OverviewTab({ result }: { result: ReviewResult }) {
  const high = result.clauses?.filter((c) => c.riskLevel === "high").length ?? 0;
  const med = result.clauses?.filter((c) => c.riskLevel === "medium").length ?? 0;
  const low = result.clauses?.filter((c) => c.riskLevel === "low").length ?? 0;
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 rounded-2xl border border-border bg-surface p-6 shadow-card">
        <p className="label-eyebrow">Executive summary</p>
        <p className="mt-3 text-[15px] leading-relaxed">{result.summary}</p>
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Document type" value={result.documentType ?? "—"} />
          <Stat label="High risk" value={String(high)} tone="high" />
          <Stat label="Medium" value={String(med)} tone="medium" />
          <Stat label="Low / info" value={String(low)} tone="low" />
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
        <p className="label-eyebrow">Recommendation</p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5">
          <Gavel className="h-4 w-4 text-primary" />
          <span className="font-medium capitalize">{result.briefing?.recommendation ?? "—"}</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          {result.briefing?.recommendationReason}
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "high" | "medium" | "low" }) {
  return (
    <div className="rounded-xl border border-border bg-surface-alt p-3">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold",
          tone === "high" && "text-risk-high",
          tone === "medium" && "text-risk-medium",
          tone === "low" && "text-risk-low",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ClausesTab({
  clauses,
  emptyLabel = "No clauses to show.",
}: {
  clauses: ReviewResult["clauses"];
  emptyLabel?: string;
}) {
  if (!clauses || clauses.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {clauses.map((c, i) => (
        <ClauseCard key={i} clause={c} />
      ))}
    </div>
  );
}

function ClauseCard({ clause }: { clause: ReviewResult["clauses"][number] }) {
  const [open, setOpen] = useState(false);
  return (
    <article
      className={cn(
        "rounded-xl border border-border bg-surface shadow-card border-l-4",
        riskBorderClass(clause.riskLevel),
      )}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h3 className="tracking-tight">{clause.title}</h3>
          <RiskBadge level={clause.riskLevel} />
        </div>
        {clause.extractedText && (
          <blockquote className="mt-3 border-l-2 border-border pl-3 text-sm italic text-muted-foreground">
            "{clause.extractedText}"
          </blockquote>
        )}
        <p className="mt-3 text-[15px] leading-relaxed">{clause.finding}</p>
        {clause.recommendation && (
          <div className="mt-3">
            <button
              onClick={() => setOpen((o) => !o)}
              className="text-xs font-medium text-primary hover:underline"
            >
              {open ? "Hide" : "Show"} suggested revision
            </button>
            {open && (
              <div className="mt-2 rounded-lg bg-surface-alt border border-border p-3 text-sm">
                {clause.recommendation}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function ComplianceTab({ result }: { result: ReviewResult }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <ListCard title="Missing clauses" items={result.missingClauses} tone="medium" />
      <ListCard title="Prohibited / unusual terms" items={result.prohibitedTerms} tone="high" />
      <ListCard title="Compliance issues" items={result.complianceIssues} tone="high" className="md:col-span-2" />
    </div>
  );
}

function ListCard({
  title,
  items,
  tone,
  className,
}: {
  title: string;
  items?: string[];
  tone: "high" | "medium";
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-surface p-5 shadow-card", className)}>
      <h3 className="tracking-tight">{title}</h3>
      {!items || items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">None flagged.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span
                className={cn(
                  "mt-1.5 h-1.5 w-1.5 rounded-full shrink-0",
                  tone === "high" ? "bg-risk-high" : "bg-risk-medium",
                )}
              />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BriefingTab({ briefing }: { briefing: ReviewResult["briefing"] }) {
  if (!briefing) return null;
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 shadow-card max-w-3xl">
      <p className="label-eyebrow">For non-legal stakeholders</p>
      <h2 className="mt-3 tracking-tight">{briefing.headline}</h2>

      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Key points</h3>
        <ul className="mt-3 space-y-2">
          {briefing.keyPoints?.map((p, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[15px]">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Top risks</h3>
        <ul className="mt-3 space-y-2">
          {briefing.topRisks?.map((p, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[15px]">
              <ShieldAlert className="mt-0.5 h-4 w-4 text-risk-high shrink-0" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-7 rounded-xl bg-accent p-4">
        <div className="flex items-center gap-2">
          <Gavel className="h-4 w-4 text-primary" />
          <span className="font-semibold capitalize">Recommendation: {briefing.recommendation}</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{briefing.recommendationReason}</p>
      </div>
    </div>
  );
}

function ProcessingState() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-12 shadow-card text-center max-w-xl mx-auto">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
      <h2 className="mt-4 tracking-tight">Reviewing your document…</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Claude is reading clause by clause. This usually takes 20–60 seconds.
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-risk-high/30 bg-risk-high-bg/30 p-8 max-w-xl mx-auto text-center">
      <ShieldAlert className="mx-auto h-7 w-7 text-risk-high" />
      <h2 className="mt-3 tracking-tight">Review failed</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Link
        to="/"
        className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark"
      >
        Try another document
      </Link>
    </div>
  );
}

function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
