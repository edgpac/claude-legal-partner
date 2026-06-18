import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getUserProfile } from "@/lib/stripe.functions";
import { useState } from "react";
import { PricingModal } from "@/components/pricing-modal";

export function CreditsBadge() {
  const [pricingOpen, setPricingOpen] = useState(false);
  const getProfile = useServerFn(getUserProfile);

  const { data } = useQuery({
    queryKey: ["user-profile"],
    queryFn: () => getProfile(),
    staleTime: 60_000,
  });

  if (!data || data.plan !== "starter") return null;

  const count = data.reviewCredits;

  return (
    <>
      <button
        onClick={() => setPricingOpen(true)}
        className="text-xs px-2.5 py-1 rounded-full border border-border bg-surface text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
      >
        {count === 0 ? (
          <span className="text-risk-high font-medium">0 reviews left · Buy more</span>
        ) : (
          <span>
            <span className="font-medium text-foreground">{count}</span> review{count === 1 ? "" : "s"} left ·{" "}
            <span className="text-primary">Buy more</span>
          </span>
        )}
      </button>
      <PricingModal open={pricingOpen} onOpenChange={setPricingOpen} />
    </>
  );
}
