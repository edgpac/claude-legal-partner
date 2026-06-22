import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key);
}

async function getOrCreateCustomer(
  supabase: SupabaseClient<Database>,
  userId: string,
  stripe: Stripe,
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", userId)
    .single();

  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: profile?.email ?? undefined,
    metadata: { supabase_uid: userId },
  });

  await supabase
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  return customer.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        priceId: z.string().min(1),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    try {
      const stripe = getStripe();
      const customerId = await getOrCreateCustomer(supabase, userId, stripe);

      const starterPriceId = process.env.STRIPE_STARTER_PRICE_ID;
      const mode: Stripe.Checkout.SessionCreateParams.Mode =
        data.priceId === starterPriceId ? "payment" : "subscription";

      console.log("[checkout] userId:", userId, "priceId:", data.priceId, "mode:", mode);

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: data.priceId, quantity: 1 }],
        mode,
        success_url: `${data.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: data.cancelUrl,
        metadata: { supabase_uid: userId },
      });

      console.log("[checkout] session created:", session.id);
      return { url: session.url };
    } catch (e) {
      console.error("[checkout] error:", e instanceof Error ? e.message : String(e));
      throw e;
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ returnUrl: z.string().url() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const stripe = getStripe();

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    if (!profile?.stripe_customer_id) {
      throw new Error("No billing account found. Make a purchase first.");
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: data.returnUrl,
    });

    return { url: portalSession.url };
  });

export const getUserProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("plan, review_credits, subscription_status, stripe_customer_id")
      .eq("id", context.userId)
      .single();
    if (error) throw new Error(error.message);
    return {
      plan: (data?.plan ?? "free") as "free" | "starter" | "pro",
      reviewCredits: data?.review_credits ?? 0,
      subscriptionStatus: data?.subscription_status ?? null,
      hasCustomer: !!data?.stripe_customer_id,
    };
  });
