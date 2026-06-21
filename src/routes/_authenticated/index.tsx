import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { UploadCloud, FileText, ArrowRight, Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { RiskBadge } from "@/components/risk-badge";
import { PricingModal } from "@/components/pricing-modal";
import { extractDocument } from "@/lib/extract-document";
import { createReview, listRecentReviews } from "@/lib/review.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

const ACCEPT = ".pdf,.docx,.txt";
const MAX_SIZE = 25 * 1024 * 1024;

type DropState = "idle" | "hover" | "processing" | "error";

function HomePage() {
  const navigate = useNavigate();
  const router = useRouter();
  const create = useServerFn(createReview);
  const list = useServerFn(listRecentReviews);
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<DropState>("idle");
  const [step, setStep] = useState<string>("");
  const [pricingOpen, setPricingOpen] = useState(false);
  const [pricingReason, setPricingReason] = useState<string | undefined>();

  const recent = useQuery({
    queryKey: ["recent-reviews"],
    queryFn: () => list(),
  });

  const handleFile = useCallback(
    async (file: File) => {
      if (!/\.(pdf|docx|txt)$/i.test(file.name)) {
        toast.error("Unsupported file type. Use PDF, DOCX, or TXT.");
        setState("error");
        return;
      }
      if (file.size > MAX_SIZE) {
        toast.error("File too large (max 25 MB).");
        setState("error");
        return;
      }
      setState("processing");
      try {
        setStep("Reading document…");
        const extracted = await extractDocument(file);
        if (extracted.wordCount < 30) {
          throw new Error("Couldn't read enough text from this file.");
        }
        setStep("Running Claude review…");
        const result = await create({
          data: {
            filename: file.name,
            fileType: file.name.split(".").pop() ?? "",
            text: extracted.text,
            pageCount: extracted.pageCount,
            wordCount: extracted.wordCount,
          },
        });
        if (result.upgradeRequired) {
          setPricingReason(result.upgradeMessage);
          setPricingOpen(true);
          setState("idle");
          setStep("");
          return;
        }
        setStep("Done.");
        await router.invalidate();
        navigate({ to: "/review/$id", params: { id: result.reviewId } });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong";
        toast.error(msg);
        setState("error");
        setStep("");
      }
    },
    [create, navigate, router],
  );

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setState("idle");
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <PricingModal open={pricingOpen} onOpenChange={setPricingOpen} reason={pricingReason} />

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="text-center max-w-2xl mx-auto">
          <p className="label-eyebrow">Contract review · NDA triage · Risk flagging</p>
          <h1 className="mt-3 text-balance">
            Drop a contract. Get a clause-by-clause review.
          </h1>
          <p className="mt-3 text-muted-foreground text-base/relaxed">
            Risky Contract Review reads your document, flags risky language, and writes a plain-English
            briefing — in under a minute.
          </p>
        </div>

        <div className="mt-10">
          <DropZone
            state={state}
            step={step}
            onEnter={() => setState((s) => (s === "processing" ? s : "hover"))}
            onLeave={() => setState((s) => (s === "processing" ? s : "idle"))}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          />
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>

        <section className="mt-14">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="tracking-tight">Recent reviews</h2>
              <p className="text-sm text-muted-foreground mt-1">Your last 5 uploads.</p>
            </div>
            <Link
              to="/history"
              className="text-sm text-primary font-medium inline-flex items-center gap-1 hover:underline"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
            {recent.isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : !recent.data || recent.data.length === 0 ? (
              <EmptyState />
            ) : (
              <ul className="divide-y divide-border">
                {recent.data.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <Link
                      to="/review/$id"
                      params={{ id: r.id }}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-surface-alt transition-colors"
                    >
                      <div className="h-9 w-9 rounded-lg bg-surface-alt border border-border flex items-center justify-center">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {r.documents?.filename ?? "Untitled"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {new Date(r.created_at).toLocaleString()}
                        </div>
                      </div>
                      {r.status === "processing" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing
                        </span>
                      ) : r.status === "error" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-risk-high">
                          <ShieldAlert className="h-3.5 w-3.5" /> Failed
                        </span>
                      ) : r.overall_risk ? (
                        <RiskBadge level={r.overall_risk as "high" | "medium" | "low"} />
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function DropZone({
  state,
  step,
  onEnter,
  onLeave,
  onDrop,
  onClick,
}: {
  state: DropState;
  step: string;
  onEnter: () => void;
  onLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={(e) => {
        e.preventDefault();
        onEnter();
      }}
      onDragLeave={onLeave}
      onDrop={onDrop}
      disabled={state === "processing"}
      className={cn(
        "group relative w-full overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-200 text-left",
        "px-8 py-16 sm:py-20 flex flex-col items-center justify-center",
        state === "idle" && "border-border bg-surface hover:border-primary-light hover:bg-surface-alt",
        state === "hover" && "border-primary bg-[oklch(0.97_0.025_45)] shadow-[var(--shadow-drop-active)]",
        state === "processing" && "border-primary bg-surface cursor-wait",
        state === "error" && "border-risk-high bg-risk-high-bg/30",
      )}
    >
      <AnimatePresence mode="wait">
        {state === "processing" ? (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center"
          >
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </div>
            <p className="mt-5 text-lg font-medium">{step || "Working…"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This usually takes 20–60 seconds.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center"
          >
            <div
              className={cn(
                "h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-200",
                state === "hover" ? "bg-primary text-primary-foreground scale-110" : "bg-primary/10 text-primary",
              )}
            >
              <UploadCloud className="h-6 w-6" />
            </div>
            <p className="mt-5 text-lg font-medium">
              {state === "hover" ? "Drop to review" : "Drop your contract here"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              or <span className="text-primary font-medium">click to browse</span>
            </p>
            <p className="mt-6 text-xs text-muted-foreground">PDF, DOCX, or TXT · up to 25 MB</p>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto h-10 w-10 rounded-full bg-surface-alt border border-border flex items-center justify-center">
        <FileText className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="mt-3 text-sm font-medium">No reviews yet</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Drop a contract above to run your first review.
      </p>
    </div>
  );
}
