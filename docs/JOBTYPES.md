# Kinds of jobs: labor only, packing days, and jobs billed on an invoice

Batch 9 (Nov 21). Richie, on the list of what MoveCrew was missing: "6-16 i think you should start planning and making now".
Item 8 was more kinds of jobs. This batch has three of them. Moves over more than one day are their own batch next, since
they touch the schedule, the crew's day, the clock and payroll everywhere.

| Kind | What it is | Truck | Price |
|---|---|---|---|
| Move | As before | Yes | By the hour or by the mile, from what's moving |
| Labor only | Loading or unloading the customer's own truck, container or rental (U-Haul, PODS) | No | By the hour for the movers |
| Packing | Packing on a day of its own, usually the day before the move | No | By the hour for the packers, plus the boxes |

Any of them can be **billed on an invoice** with terms instead of paid on the day.

## On the quote

**Kind of job** sits at the top of *The move*: Move, Labor only, Packing. Each shows only while its switch is on
(**Setup › Options › Labor-only jobs** and **Packing days**, both on to start), or when the job already is one.

- **Labor only** asks *Load and unload*, *Load only* or *Unload only*. Its addresses are *Where we load* and
  *Where we unload* (one of them for load only or unload only). No miles, no shop drive, no truck to pick.
- **Packing** has a packing date and *Where we pack*. Step 2 opens on the boxes.
- The top card says *No truck goes out*, where a move shows its truck filling up.
- Step 3 has no move type or truck: just the crew (Movers or Packers), the hours and a discount.

### The price

| | Crew | Hours |
|---|---|---|
| Labor, loading and unloading | 2 under 350 cu ft, 3 under 1,000, else 4 | cu ft ÷ (movers × crew speed) |
| Labor, load only or unload only | the same | half of that |
| Packing | 2 | boxes ÷ (packers × boxes an hour per packer) |

The hours are rounded up to the half hour and never under the Rate card's minimum (2 hours when it has none). Set the
hours or the crew by hand under *Adjust* as usual. The lines are the crew by the hour (*3 movers, 3.5 hr at $195/hr*),
then stairs (labor), specialty items (labor), *Boxes and materials* (packing, at the price a box), a discount and tax.
No truck fee, no mileage. The deposit and the estimated top price work as on a move.

**Packing days** has two numbers under its switch: boxes packed an hour per packer (8 to start) and the price a box
for boxes and materials on a packing day ($3 to start). The quote's own *Packing service for boxes* on a move is the
older per-box charge on moving day; it's still there for moves.

A labor or packing job has a price as soon as it has a name: the minimum until items or boxes go in. A move still
needs its items.

## On the schedule

A labor or packing job takes no truck slot. Its quote has `nTrucks: 0`, which the database's schedule copy keeps, so
the call center's day plan sees it the same way with no change to the database.

- The day under the price checks that the movers are free then (the movers on that day, less the ones on other jobs),
  shows it in a *Crew only* row on the timeline, and offers other times, or other days, with the movers free.
- **Board**: a *Crew only, no truck* lane, not *No truck yet*.
- **Needs scheduling** asks for its crew, and someone to run it, not a truck or a driver.

## On the job

Start job, then Finish job: there are no Start loading, Done loading, Start unloading or Done unloading steps. The bill
by the clock runs from Start job to Finish job, with no drive back to the shop. *Photos before finishing* asks for any
one photo. A packing day has no load tally. A new quote on site (the crew lead's) is for moves only.

The crew card shows the job's addresses by their names and *Labor only: no truck*.

## A packing day

On a move's job sheet (lead, quoted or booked), **Packing day › Add a packing day** makes a packing job for it: the
same customer, at the pickup, the day before at 9 AM, with the move's boxes, as a quote for the office to check and
book. The two job sheets link to each other (`d.packFor` on the packing day, `d.packDay` on the move). If the move's
quote has packing on moving day, its sheet says so: edit the quote to take it off, so the customer isn't charged twice.

## Billed on an invoice

**Setup › Options › Invoices for business customers** (on to start) adds **Bill on an invoice, with terms** to the
quote, for a business or a property manager. With it on: *Bill to (company)*, *Billing email*, *PO number* and *Terms*
(*Due on receipt*, *Net 15*, *Net 30*; Net 30 to start). The call center doesn't see it.

- No deposit.
- The crew doesn't collect: after Finish job (and the forms) the crew sees *Billed on an invoice (1004), Net 30, due
  ... The office sends it.*
- When the job is done it gets the next invoice number, from 1001, and its due date from the terms. The office's
  phone numbers it, since a crew lead's phone only has the lead's own jobs: a job a lead finished gets its number when
  it reaches the office.
- The job sheet's **Invoice** part: the number, the terms, the due date, Open, Past due or Paid, who it's billed to,
  and **Mark as sent**. **Take the invoice payment** records it when it's paid.
- **Today** shows an invoice past its due date, and no *still to collect* for one still within its terms.
- **Reports › Invoices**: the open ones, the soonest due first, and the total past due.
- The customer's app says *Billed on an invoice (1004), Net 30, due Dec 2*. They can still pay it there.

Two phones finishing invoice jobs at the same moment could give two of them the same number; change one by hand if
that ever happens.

## Data (all in the job, no database change)

| Field | |
|---|---|
| `d.jobType` | `''` a move, `'labor'` or `'packing'` |
| `d.laborKind` | `'both'`, `'load'` or `'unload'` (labor) |
| `d.packFor`, `d.packDay` | The packing day's move, and the move's packing day |
| `d.invoice`, `d.terms`, `d.billTo`, `d.billEmail`, `d.po` | Billed on an invoice; terms in days (0, 15, 30) |
| `quote.nTrucks: 0`, `quote.type` | No truck; the kind of job |
| `inv: {no, at, sent, sentBy}` | The invoice: its number, the day it was made, when it was marked sent |
| Settings `packRate`, `boxPrice`, `opt.labor`, `opt.packDays`, `opt.invoices` | |

The customer's copy (the app's `custMoveOf`, the Edge Function's `custCopy` and `custKind`) carries `type`, `labor`,
`inv: {no, due, terms}` and `quote.trucks: 0`. The Edge Function's room check for a customer booking their own quote
counts no truck for a labor or packing job.

**For the next database change:** the call center's rate card copy (`ratecard_of`) doesn't have `packRate` and
`boxPrice` yet, so the call center prices packing days at 8 boxes an hour and $3 a box until it does.

Tests: `tests/ui/jobtypes.js` (both editions) and `tests/function/cust.ts`.
