# PayMongo test checkout for member payments

The member plan and renewal buttons create a PayMongo Hosted Checkout session for GCash. The server reads the current active plan price from the database, records a pending transaction, and sends the member to PayMongo. It activates or extends the membership only after a matching paid test payment is verified. A return to `/account` verifies the checkout for local development; the signed webhook handles payments when the browser does not return. Each checkout buys one plan term; automatic billing is not enabled.

Member coaching bookings also use Hosted Checkout. The server verifies the selected trainer, dates, available one-hour slots, and current trainer price, then reserves the slots as pending sessions. The payment modal opens PayMongo in a new tab and checks the server for a verified paid GCash payment. Only then are the sessions confirmed. Cancelling checkout expires the PayMongo session and releases the reserved slots; abandoned reservations are checked after 30 minutes when coaching availability or another checkout is requested. The member demo on `/login` uses the same PayMongo test checkout and verifies payment before updating its browser-only demo state. Staff and admin demo payment screens retain their local simulator.

## Setup

1. Obtain a PayMongo account and its **Secret Test key** (`sk_test_...`) from Settings → Developers. PayMongo's Hosted Checkout quick start currently says the account needs completed KYC.
2. Add `PAYMONGO_SECRET_KEY=sk_test_...` to the repository root `.env.local`. Keep it server-side. This integration rejects live keys and does not need a public key.
3. Set `NEXTAUTH_URL` to the actual origin used by the member browser, such as `http://localhost:3000`. The checkout return URLs use this value.
4. Apply the Prisma migration with `npm run db:migrate` against the intended database before starting a checkout.
5. For webhook delivery, expose the app at a public HTTPS URL. In PayMongo Settings → Webhooks, subscribe that URL plus `/api/webhooks/paymongo` to `checkout_session.payment.paid` in test mode. Put that endpoint's signing secret in `PAYMONGO_WEBHOOK_SECRET` in `.env.local`. A PayMongo server cannot call `localhost`; local checkout confirmation still works when the browser returns to `/account`.
6. Restart the Next.js server after changing environment variables or the Prisma schema. `npm run dev` regenerates the Prisma client before starting Next.js; stop the current server first so Windows can release the Prisma engine DLL.

For coaching, keep pop-ups enabled so the hosted checkout can open in a new tab while the member page verifies its status. A signed-in member must have an email address. Coaching uses GCash only; cash is not an online checkout method.

Test mode uses simulated money. PayMongo's GCash test page can authorize or fail a payment without a real GCash account. The server accepts only `sk_test_...`, test mode Checkout Sessions, the expected order reference, the expected PHP amount, and a paid GCash payment.

The Student Plan requires a persisted `Verified` student record before checkout. The current student document submission screen does not persist one; unverified members are directed to contact the gym for approval.

PayMongo references: [Hosted Checkout quick start](https://docs.paymongo.com/docs/payment-channels-hosted-checkout-quick-start), [test mode](https://docs.paymongo.com/docs/payment-channels-testing), [webhook setup and signatures](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management).
