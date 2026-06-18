// Supabase Edge Function — Stripe webhook handler.
// Register in Stripe dashboard → Developers → Webhooks → Add endpoint.
// URL: https://<project-ref>.supabase.co/functions/v1/stripe-webhook
// Events: checkout.session.completed, invoice.paid, invoice.payment_failed,
//         customer.subscription.updated, customer.subscription.deleted

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

  // Service-role client bypasses RLS for all writes.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Idempotency: Stripe retries on timeout/network errors — skip duplicates.
  const { data: seen } = await supabase
    .from("stripe_processed_events")
    .select("event_id")
    .eq("event_id", event.id)
    .maybeSingle();
  if (seen) {
    console.log("[webhook] duplicate, skipping:", event.id);
    return ok();
  }

  console.log("[webhook] received:", event.type, event.id);

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = session.metadata?.supabase_uid;
      if (!uid) { console.error("[webhook] no supabase_uid in metadata"); }
      else if (session.mode === "payment") {
        // Starter pack — add 20 credits atomically to prevent race conditions.
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

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      const status = sub.status; // active | past_due | canceled | unpaid | ...

      if (status === "canceled" || status === "unpaid") {
        await supabase.from("profiles")
          .update({ plan: "free", subscription_status: status, review_credits: 0 })
          .eq("stripe_subscription_id", sub.id);
      } else {
        // active, past_due, trialing, etc. — sync status; ensure plan is pro.
        await supabase.from("profiles")
          .update({ plan: "pro", subscription_status: status })
          .eq("stripe_subscription_id", sub.id);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      await supabase.from("profiles")
        .update({ plan: "free", subscription_status: "canceled", review_credits: 0 })
        .eq("stripe_subscription_id", sub.id);
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
  } catch (err) {
    // Log but still mark processed — retrying a buggy handler won't help.
    console.error("[webhook] processing error:", err);
  }

  // Record event after processing (success or handled failure).
  const { error: insertErr } = await supabase
    .from("stripe_processed_events")
    .insert({ event_id: event.id });
  if (insertErr) console.error("[webhook] failed to record event:", insertErr);

  return ok();
});

function ok() {
  return new Response("OK", { status: 200 });
}
