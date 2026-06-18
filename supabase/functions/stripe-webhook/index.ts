// Supabase Edge Function — Stripe webhook handler.
// Register in Stripe dashboard → Developers → Webhooks → Add endpoint.
// URL: https://<project-ref>.supabase.co/functions/v1/stripe-webhook
// Events: checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.deleted

import Stripe from "npm:stripe@22";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, webhookSecret);
  } catch (err) {
    console.error("[webhook] signature verification failed:", err);
    return new Response("Bad signature", { status: 400 });
  }

  // Service-role client so webhook can write regardless of RLS.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  console.log("[webhook] received:", event.type);

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = session.metadata?.supabase_uid;
      if (!uid) { console.error("[webhook] no supabase_uid in metadata"); return ok(); }

      if (session.mode === "payment") {
        // Starter pack — add 20 credits atomically
        await supabase.rpc("increment_review_credits", { user_id: uid, amount: 20 });
        await supabase.from("profiles").update({ plan: "starter" }).eq("id", uid);
      } else if (session.mode === "subscription") {
        await supabase.from("profiles").update({
          plan: "pro",
          stripe_subscription_id: session.subscription as string,
          subscription_status: "active",
        }).eq("id", uid);
      }
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = (invoice as { subscription?: string }).subscription;
      if (subId) {
        await supabase.from("profiles")
          .update({ subscription_status: "active" })
          .eq("stripe_subscription_id", subId);
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = (invoice as { subscription?: string }).subscription;
      if (subId) {
        await supabase.from("profiles")
          .update({ subscription_status: "past_due" })
          .eq("stripe_subscription_id", subId);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      await supabase.from("profiles")
        .update({ plan: "free", subscription_status: "canceled", review_credits: 0 })
        .eq("stripe_subscription_id", sub.id);
    }
  } catch (err) {
    // Always return 200 so Stripe doesn't retry — log for investigation.
    console.error("[webhook] processing error:", err);
  }

  return ok();
});

function ok() {
  return new Response("OK", { status: 200 });
}
