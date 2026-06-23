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
      // HIGH-1: Validate priceId against our own catalog — reject anything not in env.
      const allowedPriceIds = new Set(
        [process.env.STRIPE_STARTER_PRICE_ID, process.env.STRIPE_PRO_PRICE_ID].filter(Boolean),
      );
      if (!allowedPriceIds.has(data.priceId)) {
        throw new Error("Invalid price selection.");
      }

      // MED-2: Validate successUrl and cancelUrl belong to our own origin.
      const APP_ORIGIN = (process.env.APP_ORIGIN ?? "https://www.riskycontract.com").replace(/\/$/, "");
      for (const [field, url] of [["successUrl", data.successUrl], ["cancelUrl", data.cancelUrl]] as const) {
        const parsed = new URL(url);
        if (parsed.origin !== APP_ORIGIN) {
          throw new Error(`${field} must be on ${APP_ORIGIN}`);
        }
      }

      const stripe = getStripe();
      const customerId = await getOrCreateCustomer(supabase, userId, stripe);

      // Retrieve the price object so we can set the correct mode regardless of
      // whether the price is one_time (payment) or recurring (subscription).
      const price = await stripe.prices.retrieve(data.priceId);
      const mode: Stripe.Checkout.SessionCreateParams.Mode =
        price.type === "one_time" ? "payment" : "subscription";

      console.log("[checkout] userId:", userId, "priceId:", data.priceId, "mode:", mode, "priceType:", price.type);

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: data.priceId, quantity: 1 }],
        mode,
        success_url: data.successUrl,
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
