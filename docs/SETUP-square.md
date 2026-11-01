# Taking cards with Square

Richie (Nov 1): "For payment processing i would also like to add remedy and square card . There should be a
place where the company can link what they use then the app will auto use their connection for the payment".

A company that already uses Square connects its own Square account in **Setup › Payments › Connect with
Square**, on Square's own sign-in page (MoveCrew never sees the password). From then on its card payments go
through Square without anyone choosing anything:

- **The card box** on the payment screen is Square's (a card typed in on the crew lead's phone or at the office).
- **Cards kept on file** are kept with Square, for that customer, and charged the same way as before.
- **Pay links** (the QR code and the text) open Square's own payment page, with the ways to pay the company has
  turned on in Square (Apple Pay and Google Pay among them).
- **The customer app's** Pay opens Square's page too, with the tip for the crew as its own line.
- **Refunds and disputes** made in Square come back onto the job by themselves.

The money goes to the company's Square account; MoveCrew takes no cut, and Square's own fees apply. The
owner can switch back to Stripe in Setup › Payments (**Use Stripe instead**) without disconnecting Square, and
**Disconnect Square** takes MoveCrew's access back (payments already taken stay in Square).

Remedy Payments has no way for an app to connect to it; it is set up by the Remedy Payments team behind a
card gateway. Tell MoveCrew which website your Remedy account signs in to (NMI, Authorize.net, USAePay...) and
that gateway can be added the same way.

## One-time setup: MoveCrew's own Square app (Richie)

Square only lets an app connect sellers once the app is registered with Square. This is done once, for all
companies.

1. Sign in at **developer.squareup.com** with your Square account and open the **Developer Console** ›
   **Create an app** (name it MoveCrew).
2. Try it in Square's **Sandbox** first (no real money): at the top of the app's page, pick **Sandbox**.
3. **Credentials**: copy the **Sandbox Application ID** (it starts with `sandbox-sq0idb-`).
4. **OAuth** (left menu): set the **Redirect URL** to
   `https://jgajcfvrzxafoqekzcug.supabase.co/functions/v1/tally-twilio/square/oauth`, save, then copy the
   **Application secret** on that page.
5. **Webhooks › Subscriptions › Add subscription**: name MoveCrew, URL
   `https://jgajcfvrzxafoqekzcug.supabase.co/functions/v1/tally-twilio/square`, API version **2026-05-20**,
   events `payment.created`, `payment.updated`, `refund.created`, `refund.updated`, `dispute.created`,
   `dispute.state.updated` and `oauth.authorization.revoked`. Save, then copy its **Signature key**.
6. **Supabase › Edge Functions › Secrets**
   (https://supabase.com/dashboard/project/jgajcfvrzxafoqekzcug/functions/secrets): add these three, pasting
   them yourself:
   - `SQUARE_APP_ID`: the application ID
   - `SQUARE_APP_SECRET`: the application secret
   - `SQUARE_WEBHOOK_KEY`: the webhook subscription's signature key
7. **Supabase › SQL Editor**: run `supabase/sql/supabase-square.sql` (it adds one table and one column, removes
   nothing, and is safe to run again).
8. Try it: in the Developer Console's **Sandbox test accounts**, open the test account's **Seller Dashboard**
   (Square wants it open in the same browser), then in MoveCrew: Setup › Payments › **Connect with Square** ›
   Allow. Take a payment on a test job with Square's test card **4111 1111 1111 1111** (any date in the future,
   CVV 111, ZIP 94103).

Without `SQUARE_WEBHOOK_KEY`, a payment on a pay link still lands when someone looks at the job (Check now, or
the payment screen), and refunds and disputes made in Square wait for that too.

## Going live

In the Developer Console switch to **Production**: copy the production Application ID (it starts with
`sq0idp-`) and Application secret, set the same Redirect URL, and add the same webhook subscription for
production. Replace the three secrets in Supabase with the production ones. Each company then presses
**Connect with Square** again: sandbox and live connections are kept apart, like Stripe's test and live mode.

## What MoveCrew keeps

The Square seller and location a company's cards are taken at, and the tokens Square gives MoveCrew for it,
sealed (AES-GCM, with a key made from `SQUARE_APP_SECRET`) in the `pay_square` table, which only the server can
read. Card numbers never touch MoveCrew: they are typed into Square's own card box or page, and only the brand,
last four digits, expiry and name of a card kept on file are saved, as with Stripe.
