# Long-distance moves

Batch 12 (Nov 22), from Richie's list of what MoveCrew was missing. MoveCrew already had local moves (by the hour)
and mileage moves (the miles plus loading and unloading time, [PRICING.md](PRICING.md)). Long distance is a third
kind, run the way interstate movers run it: priced by weight and distance, with a delivery window, a binding or
non-binding estimate, weight tickets, and the 110% rule at delivery.

The rules behind it were checked on Nov 22 against the federal rules for interstate household goods moves (49 CFR
375): a written estimate, binding or non-binding, based on the weight or volume; at delivery a non-binding move needs
at most 110% of the estimate, plus services the customer asked for after, and "the mover will bill you for any
remaining charges after 30 days from delivery" (Appendix A); the delivery spread, with 24 hours' notice; the
customer can ask for a reweigh before unloading, at no charge; weighing the empty truck before loading and the
loaded truck after (origin weigh), or the net on a certified scale; the FMCSA's two booklets go with the estimate,
and a link is fine. These are the rules for a move that crosses a state line; a move inside one state follows that
state's rules. MoveCrew isn't legal advice: a mover should check its own tariff and paperwork.

**Setup › Options › Long-distance moves** (on to start). Its rates are in **Setup › Rate card › Long distance**.

## The price

- **Move type › Long distance: by weight and distance** on the quote (Adjust, under the price). With **Long
  distance from (miles)** set in the Rate card, a move that far or farther is long distance by itself (0, to
  start: only when it's picked on the quote).
- **The weight:** the items at 7 lb a cu ft (the usual way to turn volume into weight), or typed on the quote
  (**Estimated weight**). At least the **Least weight billed** (2,000 lb to start).
- **The line haul:** the weight, per 100 lb, at the rate for the miles. The Rate card has the bands: up to 500 mi
  $55, 1,000 mi $70, 1,500 mi $82, 2,000 mi $92, 2,500 mi $100, and past that $108 (0 in Up to). Every number is the
  company's to set. "Line haul: 5,579 lb at $82 per 100 lb, 1,300 mi".
- **Fuel surcharge:** a % of the line haul (0 to start, so no line).
- Stairs, packing, specialty items, a discount, sales tax and the deposit as on any move. No hourly line, no truck
  fee, no mileage, no night fee: the line haul covers the truck and the drive.
- **Estimate:** **Non-binding** (to start; the Rate card's **Estimates start as**) or **Binding**. Non-binding, the
  price shows "At delivery, at most (110%)" and "Non-binding: the bill comes from the weight; anything past 110% is
  billed 30 days after delivery." Binding: "Binding estimate: the bill is this price, for the things and services on
  it."
- **Interstate:** ticked by itself when the pickup and delivery addresses end in different states, and by hand
  otherwise. The quote's note then says to give the customer "Your Rights and Responsibilities When You Move" and
  "Ready to Move?" with the estimate (their app links both) and to put the **USDOT number** and **MC number** in
  Setup › Company.
- The call center can't quote one: its copy of the rate card has none of this.

## The delivery

- **The window:** it starts after the days on the road (the miles at the Rate card's **Miles a day on the road**,
  500 to start: 1,300 mi is 3 days) and runs the **Delivery window (days)** (5 to start). It follows the move date
  until someone changes it.
- **The delivery day:** blank until it's set (on the quote, or on the job sheet's Long distance part, which logs
  "Delivery day set: Fri, Dec 4"). Until then the window's last day holds the truck.
- On the schedule the move is a two-day job (batch 10's days, [MULTIDAY.md](MULTIDAY.md)): the move date is loading,
  the delivery day unloading, the hours shared between them. The days between, the truck is **on the road**, and
  for the drive back after delivery (the same days on the road) **driving back**; its crew too, unless **The crew
  goes with the truck** is unticked. Those days are blocks of their own, the whole day, on the day plan ("On the
  road · Ortiz Family") and the Board ("on the road all day", with the crew and when it delivers), and a job in that
  truck or with that crew then is double-booked. The Board and Today call its days "loading", "delivery" and
  "delivery window ends".
- **Today:** "Set the delivery day: Ortiz Family" from two days before the window opens (red once it has), with "tell
  them 24 hours ahead".

## Weights and the bill

- **The crew lead's card** (running or finished): **Weights**: Empty truck and Loaded truck (lb), or one scale
  ticket's net weight, then **Save weights**, and **+ Scale ticket photo**. "Weigh the empty truck before loading
  and again loaded, with full tanks and nobody on board, and take a photo of each ticket." It says when the loaded
  truck weighs less than the empty one. The office can type the net weight on the job sheet too.
- **Non-binding:** the bill follows the net weight: one line, "By the weight: 7,811 lb net (estimated 5,579 lb)",
  the difference from the estimate (the line haul and fuel worked out again from the weight, the rest as quoted).
- **At delivery:** at most 110% of the estimate, plus the charges and materials added on the job. **Collect
  payment** starts at that ("At delivery: $5,032.50 to collect … The rest, $1,140, is billed 30 days after
  delivery."), and the customer can pay more if they want. Once that's paid, the rest is billed on an invoice dated
  the delivery day, Net 30 (batch 9's invoices, [JOBTYPES.md](JOBTYPES.md)): Reports › Invoices lists it, and the
  crew lead's card says "The rest, $1,140, is billed 30 days after delivery (invoice 1005, due …). The office sends
  it."
- **Binding:** the bill stays the estimate; the weight is kept for the record.

## The customer

In their app, under the move: **Long distance**: the window ("Your Moving Co. sets the day and tells you at least 24
hours ahead") or the delivery day; the estimate (non-binding: what they pay at most at delivery and that the rest is
billed 30 days after); the estimated weight, then the scale's ("You can ask for a reweigh before unloading, at no
charge"); and for an interstate move the two booklets and the USDOT and MC numbers. Paying in the app at delivery
asks for the at-delivery amount; the server works it out the same way (`ldNowC`) and charges no more than it.

## Data

- `d.moveKind` 'long'; `d.ld` = {est 'nb'|'b', lbs, w0, w1, wSet, day, dayTime, inter, crew}; `d.days` = [{date,
  time, ld 'deliver', set, back (days driving back), crew}] (`ldSync` keeps it; the schedule's database copy keeps
  `d.days` whole, so the call center sees the road days).
- The quote: `kind` 'long', `flat` (binding), `nte` 0, `fixed` (the lines but the line haul, fuel and tax), `ld` =
  {est, lbs, bill, min, rate, fuel, miles, cap (110% of the total)}.
- `j.wt` = {tare, gross, net, how 'origin'|'scale'|'office', by, at}; the bill's line `extras` id 'weight'.
- Settings: `ldMiles`, `ldRates` [{to, r}], `ldMinLbs`, `ldFuelPct`, `ldSpread`, `ldMiDay`, `ldEst`, `usdot`, `mcNo`.
- The customer's copy: `ldInfo` {est, w0, w1, day, lbs, net, cap, inter, usdot, mc} and `bill.now`.

Tests: `tests/ui/longdist.js` (both editions) and `tests/function/cust.ts`.
