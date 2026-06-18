import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, Crown, Zap, Shield } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PricingModal } from "@/components/pricing-modal";
import { getUserProfile, createPortalSession } from "@/lib/stripe.functions";

export const Route = createFileRoute("/_authenticated/settings/billing")({
  component: BillingPage,
});

function BillingPage() {
  const [pricingOpen, setPricingOpen] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const getProfile = useServerFn(getUserProfile);
  const portal = useServerFn(createPortalSession);

  const justPurchased =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("success") === "1";

  const { data, isLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: () => getProfile(),
    staleTime: justPurchased ? 0 : 60_000,
  });

  async function openPortal() {
    setPortalLoading(true);
    try {
      const result = await portal({ data: { returnUrl: window.location.href } });
      if (result.url) window.location.href = result.url;
    } catch {
      toast.error("Could not open billing portal. Please try again.");
      setPortalLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8">
          <h1 className="tracking-tight">Billing</h1>
          <p className="mt-1 text-muted-foreground text-sm">Manage your plan and payment details.</p>
        </div>

        {justPurchased && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Payment confirmed — your plan has been updated.
          </div>
        )}

        <div className="rounded-2xl border border-border bg-surface shadow-card p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <PlanDetails
              plan={data?.plan ?? "free"}
              reviewCredits={data?.reviewCredits ?? 0}
              subscriptionStatus={data?.subscriptionStatus ?? null}
              hasCustomer={data?.hasCustomer ?? false}
              onUpgrade={() => setPricingOpen(true)}
              onPortal={openPortal}
              portalLoading={portalLoading}
            />
          )}
        </div>
      </main>

      <PricingModal open={pricingOpen} onOpenChange={setPricingOpen} />
    </div>
  );
}

function PlanDetails({
  plan,
  reviewCredits,
  subscriptionStatus,
  hasCustomer,
  onUpgrade,
  onPortal,
  portalLoading,
}: {
  plan: "free" | "starter" | "pro";
  reviewCredits: number;
  subscriptionStatus: string | null;
  hasCustomer: boolean;
  onUpgrade: () => void;
  onPortal: () => void;
  portalLoading: boolean;
}) {
  const planMeta = {
    free: { label: "Free", icon: <Shield className="h-5 w-5" />, color: "secondary" as const },
    starter: { label: "Starter", icon: <Zap className="h-5 w-5 text-amber-500" />, color: "secondary" as const },
    pro: { label: "Pro", icon: <Crown className="h-5 w-5 text-primary" />, color: "default" as const },
  }[plan];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {planMeta.icon}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{planMeta.label} Plan</span>
              {subscriptionStatus && subscriptionStatus !== "active" && (
                <Badge variant="destructive" className="text-[10px]">
                  {subscriptionStatus === "past_due" ? "Past due" : subscriptionStatus}
                </Badge>
              )}
            </div>
            {plan === "free" && (
              <p className="text-sm text-muted-foreground">1 free review included</p>
            )}
            {plan === "starter" && (
              <p className="text-sm text-muted-foreground">
                {reviewCredits} review{reviewCredits === 1 ? "" : "s"} remaining
              </p>
            )}
            {plan === "pro" && (
              <p className="text-sm text-muted-foreground">Unlimited reviews · $14.99/month</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {plan !== "pro" && (
            <Button size="sm" onClick={onUpgrade}>
              Upgrade
            </Button>
          )}
          {plan === "starter" && (
            <Button size="sm" variant="outline" onClick={onUpgrade}>
              Buy more
            </Button>
          )}
          {hasCustomer && (
            <Button size="sm" variant="outline" onClick={onPortal} disabled={portalLoading}>
              {portalLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Manage billing <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {plan === "free" && (
        <div className="rounded-xl bg-surface-alt border border-border p-4 text-sm text-muted-foreground">
          You're on the free plan. Upgrade to run more reviews.
        </div>
      )}
    </div>
  );
}
