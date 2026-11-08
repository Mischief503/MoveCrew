# MoveCrew on iPhones

Richie (Nov 8): "If we want to make this actually top tier stuff we will need it avaliable for iphones as well", then,
after reading what an App Store app takes: "we will just do the webbase right now and then when we get it live and
running ill do more".

## Now: the website on the Home Screen

An iPhone gets MoveCrew from the website (`https://mischief503.github.io/MoveCrew/`), no store involved:

1. In **Safari**, tap **Share**. On iOS 26 Share sits under **⋯** next to the address bar.
2. Tap **Add to Home Screen**, keep **Open as Web App** on, tap **Add**.
3. Open **MoveCrew** from the Home Screen and sign in there. A Home Screen app keeps its own sign-in, apart from
   Safari's, so someone signed in in Safari signs in once more.

It opens full screen with its own icon (`web/icons/apple-touch-icon.png`, 180 px, made by `scripts/make_icons.py`; the
picture at 90% on its dark colour so the iPhone's rounded corners don't cut the glowing frame) and the name MoveCrew
(`apple-mobile-web-app-title`). Since iOS 26 any site added this way opens as a web app.

What the app does about it (Nov 8):

- **The invite.** Someone added on Setup › Employees who works in the field is texted one link, the website's
  `?get=app` page (unless Setup has another link). Before sign-in it shows the steps for the phone it was opened on:
  an iPhone (or an iPad, which says it's a Mac) the three steps above, an Android phone **Download the Android app**,
  a computer **Download MoveCrew for Windows** or the browser; the others are folded under "Another phone or a
  computer?", and **Sign in here instead** goes on to the usual sign-in. The office's Windows link is unchanged.
- **More › Get the app**: someone signed in on the website (not the installed app) gets the same steps.
- **The customer's** Profile › Get the app: the iPhone steps above.
- **Sign-in inside an iPhone's Home Screen app** is the emailed code. The Google button isn't shown there (as in the
  Android and Windows apps): Google's page opens in a browser sheet and may not come back signed in.
- **Safari's engine** checks every change on GitHub: Tests runs `tests/ui/iphone.js` in WebKit with Playwright's
  iPhone 15 (the office's day, a job, Collect payment with the tip, the customer's move, Book another move, Get the
  app; no errors, nothing wider than the screen). Here it runs in Chromium; `tests/ui/getapp.js` checks the page,
  More, the invite and the sign-in rule.

Not done for iPhones yet: push notifications (an iPhone allows them for a Home Screen web app since iOS 16.4, asked
for from a tap; MoveCrew texts instead), and a domain of MoveCrew's own (moving the website later means everyone adds
it to the Home Screen again).

## Later: an App Store app

Besides building it (a wrapper around the same app, like the Android one), Apple needs:

- **The Apple Developer Program**, 99 USD a year, Richie's to join (Apple Account with two-factor sign-in, an ID
  check). As an individual his legal name shows as the seller. As a company: a legal entity (no DBAs), a free
  D-U-N-S Number, a public website on the company's own domain and a work email at that domain.
  ([Apple: program enrollment](https://developer.apple.com/help/account/membership/program-enrollment/))
- **A Mac build**: uploads must be built with Xcode 26 or later (since April 28, 2026). GitHub's macOS runners can
  build it like the Android app; Richie pastes the signing keys into GitHub's secrets.
  ([Apple: upcoming requirements](https://www.developer.apple.com/news/upcoming-requirements/))
- **App Review**
  ([guidelines](https://developer.apple.com/support/downloads/terms/app-review-guidelines/App-Review-Guidelines-English-UK.pdf)):
  - 4.2: more than a repackaged website, so the app uses the iPhone's camera, location and notifications natively.
  - 4.8: with Google sign-in offered, an equal option that keeps the email private (Sign in with Apple). Not needed
    if the app signs in only with MoveCrew's own emailed code.
  - 5.1.1(v): an app where people make an account must let them delete it inside the app.
  - 3.1.3(e): moving services are paid with cards, Apple Pay, Stripe or Square, never Apple's in-app purchase.
  - 3.1.3(c): the companies' membership is bought on the website; the app may let them use what they bought there.
- **The listing**: screenshots, a privacy policy, the App Privacy answers, a support page, a sign-in for Apple's
  reviewer (a test company), and TestFlight to try it on his own iPhone first.
