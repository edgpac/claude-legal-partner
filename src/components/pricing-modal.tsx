import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Zap, Crown } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createCheckoutSession } from "@/lib/stripe.functions";
import { toast } from "sonner";

const STARTER_PRICE_ID = import.meta.env.VITE_STRIPE_STARTER_PRICE_ID as string;
const PRO_PRICE_ID = import.meta.env.VITE_STRIPE_PRO_PRICE_ID as string;

type Plan = "starter" | "pro";

interface PricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: string;
}

export function PricingModal({ open, onOpenChange, reason }: PricingModalProps) {
  const [loading, setLoading] = useState<Plan | null>(null);
  const checkout = useServerFn(createCheckoutSession);

  async function handleSelect(plan: Plan) {
    const priceId = plan === "starter" ? STARTER_PRICE_ID : PRO_PRICE_ID;
    if (!priceId) {
      toast.error("Billing is not configured yet.");
      return;
    }
    setLoading(plan);
    try {
      const result = await checkout({
        data: {
          priceId,
          successUrl: `${window.location.origin}/?upgraded=1`,
          cancelUrl: window.location.href,
        },
      });
      if (result.url) {
        window.location.href = result.url;
      }
    } catch {
      toast.error("Could not start checkout. Please try again.");
      setLoading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Upgrade to keep reviewing</DialogTitle>
          {reason && (
            <DialogDescription className="text-sm text-muted-foreground">
              {reason}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          <PlanCard
            name="Starter"
            price="$4.99"
            period="one-time"
            description="A pack of 20 contract reviews. No expiry."
            features={["20 reviews", "Full clause analysis", "Plain-English briefing", "Risk scoring"]}
            icon={<Zap className="h-5 w-5" />}
            cta="Buy Starter Pack"
            loading={loading === "starter"}
            onSelect={() => handleSelect("starter")}
          />
          <PlanCard
            name="Pro"
            price="$14.99"
            period="/month"
            description="Unlimited reviews for active teams."
            features={["Unlimited reviews", "Full clause analysis", "Plain-English briefing", "Risk scoring", "Priority support"]}
            icon={<Crown className="h-5 w-5" />}
            cta="Start Pro"
            highlight
            loading={loading === "pro"}
            onSelect={() => handleSelect("pro")}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlanCard({
  name,
  price,
  period,
  description,
  features,
  icon,
  cta,
  highlight,
  loading,
  onSelect,
}: {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  icon: React.ReactNode;
  cta: string;
  highlight?: boolean;
  loading: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={
        "rounded-2xl border p-6 flex flex-col gap-4 " +
        (highlight ? "border-primary bg-primary/5 shadow-md" : "border-border bg-surface")
      }
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-primary">{icon}</span>
            <span className="font-semibold">{name}</span>
            {highlight && <Badge className="text-[10px] px-1.5 py-0">Popular</Badge>}
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold">{price}</span>
            <span className="text-sm text-muted-foreground">{period}</span>
          </div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <ul className="space-y-1.5 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm">
            <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      <Button
        onClick={onSelect}
        disabled={loading}
        variant={highlight ? "default" : "outline"}
        className="w-full"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : cta}
      </Button>
    </div>
  );
}
