import { fulfillCheckout, type CheckoutSession } from '@/src/paymongo/checkout';
import { fulfillDemoCheckout } from '@/src/paymongo/demoCheckout';
import { fulfillCoachingCheckout } from '@/src/paymongo/coachingCheckout';
import { validTestWebhookSignature } from '@/src/paymongo/validation';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET?.trim();
  if (!secret) return Response.json({ error: 'Webhook is not configured.' }, { status: 503 });
  const body = await request.text();
  if (!validTestWebhookSignature(request.headers.get('paymongo-signature'), body, secret)) {
    return Response.json({ error: 'Invalid signature.' }, { status: 401 });
  }
  let event: { data?: { type?: string; livemode?: boolean; data?: CheckoutSession;
    attributes?: { type?: string; livemode?: boolean; data?: CheckoutSession } } };
  try { event = JSON.parse(body); } catch { return Response.json({ error: 'Invalid event.' }, { status: 400 }); }
  const payload = event.data?.type === 'event' ? event.data.attributes : event.data;
  if (payload?.type !== 'checkout_session.payment.paid' || payload.livemode !== false) {
    return Response.json({ received: true });
  }
  const checkout = payload.data;
  if (!checkout?.id || !checkout.attributes) return Response.json({ error: 'Invalid event.' }, { status: 400 });
  try {
    const fulfilled = checkout.attributes.reference_number?.startsWith('DEMO-')
      ? await fulfillDemoCheckout(checkout)
      : checkout.attributes.reference_number?.startsWith('COACH-')
        ? await fulfillCoachingCheckout(checkout)
        : await fulfillCheckout(checkout);
    if (!fulfilled) return Response.json({ error: 'Checkout could not be matched.' }, { status: 409 });
    return Response.json({ received: true });
  } catch (error) {
    console.error('PayMongo test webhook could not be processed:', error);
    return Response.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
