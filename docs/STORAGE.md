# Storage

Batch 13 (Nov 22), from Richie's list of what MoveCrew was missing. Moving companies keep customers' things in
their warehouse between moves: the new place isn't ready yet, the closing slipped, a long-distance delivery comes
later. The things go in storage units, billed every month, and come out on a delivery move.

They're called **units**, numbered **Unit #1, Unit #2** and so on, each with its own size and price a month (Richie,
Nov 22: "Can we change it to say unit #1, unit #2 and the unit size and monthly cost should show on the tile as
well", and "Stop calling them vaults and call them units"). The first version called them vaults; "Vault 3" is
"Unit #3" now, everywhere.

**Setup › Options › Storage** (on to start, under Office). The units are in **Setup › Storage**.

## The storage account

A customer's storage is an account of its own, a job like any other: payments, pay links, the customer app, texts
and the activity all work on it the same way. Its status is **In storage** (a dashed pill), so the Board, Today's
jobs, the crew's screens, Sales and the reports on moves never count it as a move.

- **The units** it has, from Setup › Storage. A unit can be in one account at a time.
- **The price**: each unit's price a month, kept from the day it goes in. Raising a unit's price in Setup changes it
  for the next customer, not for the ones in it now; a customer's price for a unit can be changed on their account.
  The account's month is its units' prices added up.
- **The bills**: the first comes the day it goes in, then the same day of each month (the 28th at the latest, so
  a move-in on the 31st is billed on the 28th after that). "Storage Oct 13 to Nov 12: Unit #3, Unit #4". A bill
  is made on its day by the office's phone or computer, and every office phone makes the same one, so nothing is
  billed twice. Changing the units or a price changes the next bills; the ones made stay.
- **What's owed** is the bills less what's paid, oldest bill first. A bill is **past due** 10 days after it comes.
- A **handling fee** (Setup › Storage, $0 to start) goes on the account once, when it's made.

## Put in storage

On a move's job sheet (quoted, booked, running, finished or paid), the **Storage** part near the end: tap the units
(the free ones show, each with its size and price, "Unit #3 · 5×7×8 ft · $150/mo"), check **Goes in (the first
bill)** (the move's last day, to start), then **Put in storage: 2 units, $300 a month**. The move then says "Into
storage after this move: Unit #3, Unit #4" and opens the account, and the crew's card for the move says **Into
storage: Unit #3, Unit #4** under the addresses.

**Someone already in storage** (Setup › Storage): for customers who were in the warehouse before MoveCrew. Their
name, phone and email, their units, and the **Next bill** (the bills start that day; none before).

## Moves into storage

Richie, Nov 22: "Can we add a type of job, a storage in option. This auto puts your storage location as the last
stop, and will auto suggest storage units to fit the cubic foot of stuff in the estimate."

- **On a quote**, Kind of job has **Into storage** (with Options › Storage on): a move whose last stop is your
  warehouse. Tapping it puts the warehouse address (Setup › Storage, or the shop's) in as the delivery, called
  **Storage warehouse**; tapping Move again takes it back off. The move is priced like any move.
- **The units for it** are under the price (Price and book), from the estimate's cubic feet: "About 407 cu ft. Unit
  #1, Unit #2 hold 560 cu ft: $300 a month, billed from the move day." It picks the units that cost the least a
  month and still hold it all, then the fewest, then the least room left over, then the first in Setup's list. Tap
  the units to change them; **Pick for me** goes back to the suggestion. The price says **Then storage: Unit #1, Unit
  #2, $300/mo** under the total.
- **How much a unit holds** comes from its size in Setup › Storage: 5×7×8 ft is 280 cu ft, a floor size like 10×10
  ft counts 8 ft high (800 cu ft), or put the cubic feet ("250 cu ft"). A unit with no size it can read isn't
  picked by itself (Setup › Storage says so under it), but it can be tapped.
- **Held for it**: once the move is booked, its units are held for it until it goes in. They aren't free on the
  Storage screen (a blue tile, "Held · in Dec 3", which opens the move), they aren't picked for another move, and
  they can't be given to someone already in storage or removed in Setup. The Storage screen lists the moves
  **Coming in**.
- **Its job sheet** (Storage, near the end): "Into storage after this move: Unit #1, Unit #2 · $300 a month. They
  hold 560 cu ft, for about 407 cu ft of things." Tap the units to change them; it goes in the job's activity. If a
  unit was taken meanwhile, it says so and the unit comes off.
- **When the move is done** (Complete or Paid), it goes into storage by itself: an office phone or computer opens
  its storage account with its units at the prices quoted, billed from the move's last day, and the move points to
  it. Every office phone gives it the same id, so it opens once. If every unit was taken, it waits until units are
  tapped on its job sheet.
- **The crew's card** says **Into storage: Unit #1, Unit #2** under the addresses, and the Jobs list tags it **Into
  storage**. **The customer app** says "Into storage after the move: Unit #1 (5×7×8 ft), Unit #2 (5×7×8 ft), $300 a
  month" under the day, until the account opens and shows instead.

## The account's job sheet

- At the top: **Billed**, **Paid**, and **Owed** (**Past due** once a bill is 10 days old, or **Paid up**), with
  **Collect payment** when something's owed. No Edit quote, no Schedule, no crew.
- **Storage account** (open to start): since when, the move it came from (**Open it**), the units (tap to add or
  take one off; the last one stays; one added comes at its price now), **A month for each unit**, what this
  customer pays for each, with its size, **In storage since**, and **First bill** until the first one comes.
  "Billed on the 13th of each month. Next: Sun, Dec 13, $300." Then each bill: **Paid**, **Part paid**, **Owed** or
  **Past due**.
- **Add a charge or credit**: a late fee, a credit for a box taken out early. It goes on the account on its day,
  and payments go to the oldest first.
- **Deliver from storage**: a move quote from the warehouse, with what's stored on it ("From storage: Unit #3,
  Unit #4" on the crew's card). It opens to finish: put in where it goes and the day, then save or book it. When that
  move starts, the account comes **out of storage** that day: no bills from then on (the first month stays), and it's
  **Complete** while something's owed, then **Paid**.
- **Taken out another way: close it** (tap twice): out of storage today, the same way.
- A closed account can be **Put back in storage** while its units are free.

## The Storage screen

Richie, Nov 22: "Why is there not a storage tab that tells you what is available and what is taken. Who is paid and
who owes." **Storage** is in More (and in the side list on a computer), for the owner and dispatch, while Options ›
Storage is on or anyone has been in storage.

- **At the top:** units free ("6 Units free, of 12"), Taken, Owed (red when something is) and Storage a month.
  Dispatch sees the last two only with Options › Dispatch sees revenue on.
- **Units:** every unit as a tile with its size and price a month ("Unit #3", then "5×7×8 ft" and "$150/mo"; a taken
  one shows what that customer pays): Free (dashed), or the customer's name and where they stand, green Paid up, orange
  "$420 owed", red "$600 past due". Tap a taken one to open that customer's account. A legend says what the colours
  mean.
- **Who's in storage:** past due first (the oldest first), then owing, then paid up, and anyone out of storage who
  still owes: the name, a month, the units, since when and the next bill, and Paid up or what they owe. **All**,
  **Owe** and **Paid up** filter it.
- For the owner, a button to Setup › Storage at the bottom. Jobs › In storage has **Storage ›** to it.

## Where it shows

- **Storage** (above), and **Jobs**: an **In storage** chip. Each account: "Since Oct 13 · Unit #3, Unit #4 · $300 a
  month", $300/mo, and "$300 owed" (orange) or "$600 past due" (red).
- **Today**: "Storage bill past due: Lena Wu", "$600 owed · since Tue, Oct 13" (three or more on one row, which
  opens Jobs › In storage).
- **Reports › Storage**: who's in storage now, the units in use of how many, a month's storage, what's owed and
  what's past due, and what was billed in the dates picked.
- **Job history**: a closed, paid account, the day after.
- **The customer app**: "In storage since Tuesday, October 13", their units with sizes ("Unit #3 (5×7×8 ft)") at the
  warehouse (Setup › Storage's address, or the shop's), $300 a month and the next bill; **Pay your storage bill** with
  what's owed (Google Pay, Apple Pay or a card, the same pay page as a move; no tip); the next bill; **When you want
  your things: call or text to set a delivery day**; and **Your storage bills**, with their units and prices and
  what's in storage. Once it's out: "Out of storage".

## Setup › Storage

What new units start at ($150 a month), the handling fee, the warehouse's address (blank: the shop's), and the
units: 12 to start, Unit #1 to Unit #12, each 5×7×8 ft at $150 a month. Each row
is the unit's name, size and price, changed right in the list; **Add** a unit with its name (Unit #13 when left
blank), size and price; remove one (×) while it's free. A unit in use says whose it is.

## Autopay

Batch 15 (Nov 22). A storage account's card on file can pay each bill by itself, with the customer's OK. On the
account (Storage account, under the bills): **Autopay: a card on file pays each bill by itself**, then the customer's
card (tap twice). It starts with the next bill: what's owed when it's turned on is collected the usual way (Collect
payment). From then on, when a bill is made, the office's phone or computer asks the server to charge that card what's
owed, and the server does it once for that bill, however many office phones ask. The payment shows on the account as
"Visa ending 4242 (autopay)".

- No card on file yet: send a pay link with **Keep the card on file** (or the customer pays in their app and keeps it).
- It didn't go through (a declined card, an expired one): the account says why, Today shows **Autopay didn't go
  through** (or says so on the past-due row), and it isn't tried again for that bill. Collect payment, or send a pay
  link. The next bill is tried as usual.
- **Turn autopay off** on the account any time. The customer app says "Autopay: Visa ending 4242 pays each bill."
- It needs the hosted MoveCrew (the website, Android or Windows) with Stripe or Square, and Options › Cards on file.
  Until the nightly run comes with messages (batch 14), a bill is made, and charged, when someone in the office opens
  MoveCrew that day or after.

## Not in this batch

- The bills aren't texted or emailed to the customer on their own yet: they see them and pay in the customer app,
  and the office can send a pay link from the account. Monthly bill texts and emails come with messages (batch 14).
- Storage by the cubic foot or by the pallet, late fees, and partial pickups (some things out, the rest stays) are
  done by hand for now: the units, a customer's prices, and Add a charge or credit on the account.
