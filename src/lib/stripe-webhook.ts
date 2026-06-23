import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import WebSocketImpl from 'ws'

const STARTER_CREDITS = 20

function getAdminSupabase() {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing Supabase admin credentials')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocketImpl as unknown as typeof WebSocket },
  })
}

export async function handleStripeWebhook(request: Request): Promise<Response> {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    console.error('[webhook] missing stripe-signature or STRIPE_WEBHOOK_SECRET')
    return new Response('Missing signature or webhook secret', { status: 400 })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return new Response('Missing Stripe key', { status: 500 })
  const stripe = new Stripe(stripeKey)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (e) {
    console.error('[webhook] signature verification failed:', e instanceof Error ? e.message : String(e))
    return new Response('Webhook signature verification failed', { status: 400 })
  }

  const supabase = getAdminSupabase()

  // Idempotency: skip already-processed events
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('stripe_processed_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle()

  if (existing) {
    console.log('[webhook] duplicate event, skipping:', event.id)
    return new Response('OK', { status: 200 })
  }

  try {
    await handleStripeEvent(event, stripe, supabase)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('stripe_processed_events').insert({ event_id: event.id })
  } catch (e) {
    console.error('[webhook] handler error:', e instanceof Error ? e.message : String(e))
    return new Response('Internal error', { status: 500 })
  }

  return new Response('OK', { status: 200 })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleStripeEvent(event: Stripe.Event, stripe: Stripe, supabase: any) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.supabase_uid
      if (!userId) {
        console.warn('[webhook] checkout.session.completed: no supabase_uid in metadata')
        return
      }

      if (session.mode === 'payment') {
        // One-time Starter purchase
        await supabase.rpc('increment_review_credits', { user_id: userId, amount: STARTER_CREDITS })
        // Only upgrade from free — don't overwrite pro
        await supabase.from('profiles').update({ plan: 'starter' }).eq('id', userId).eq('plan', 'free')
        console.log('[webhook] starter one-time: +', STARTER_CREDITS, 'credits to', userId)
      } else if (session.mode === 'subscription' && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        const priceId = sub.items.data[0]?.price.id
        const starterPriceId = process.env.STRIPE_STARTER_PRICE_ID
        const businessPriceId = process.env.STRIPE_BUSINESS_PRICE_ID
        const plan = priceId === starterPriceId ? 'starter' : priceId === businessPriceId ? 'business' : 'pro'

        const update: Record<string, unknown> = {
          plan,
          stripe_subscription_id: sub.id,
          subscription_status: sub.status,
        }
        if (plan === 'starter') update.review_credits = STARTER_CREDITS

        await supabase.from('profiles').update(update).eq('id', userId)
        console.log('[webhook] subscription checkout completed:', plan, 'for', userId)
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_subscription_id', sub.id)
        .maybeSingle()
      if (!profile) return
      await supabase.from('profiles').update({ subscription_status: sub.status }).eq('id', profile.id)
      console.log('[webhook] subscription updated:', sub.status, 'for', profile.id)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await supabase.from('profiles').update({
        plan: 'free',
        subscription_status: 'canceled',
        stripe_subscription_id: null,
      }).eq('stripe_subscription_id', sub.id)
      console.log('[webhook] subscription canceled:', sub.id)
      break
    }

    case 'invoice.payment_succeeded': {
      // Monthly Starter renewal: top up credits each billing cycle
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoice = event.data.object as any
      if (!invoice.subscription || invoice.billing_reason !== 'subscription_cycle') return
      const sub = await stripe.subscriptions.retrieve(invoice.subscription as string)
      const priceId = sub.items.data[0]?.price.id
      if (priceId !== process.env.STRIPE_STARTER_PRICE_ID) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_subscription_id', sub.id)
        .maybeSingle()
      if (!profile) return

      await supabase.rpc('increment_review_credits', { user_id: profile.id, amount: STARTER_CREDITS })
      console.log('[webhook] starter renewal: +', STARTER_CREDITS, 'credits to', profile.id)
      break
    }

    default:
      console.log('[webhook] unhandled event type:', event.type)
  }
}
