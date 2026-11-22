# Damage claims and truck reminders

Batch 11 (Nov 22), from Richie's list of what MoveCrew was missing: damage claims, and truck and driver reminders.
The drivers' reminders were already there: a license and a DOT medical card on the employee's profile show on Today
30 days before they run out. This batch adds the claims and the trucks.

## Damage claims

**Setup › Options › Damage claims** (on to start).

- **The job sheet** of a running or finished job has **Damage claims**. Each claim shows the item, who it's from (the
  customer, the crew or the office), when, what happened and the amount claimed. When the item is on the job, it
  also shows its released value: about $0.60 a pound at 7 lb a cu ft, the coverage the law sets when the customer
  bought nothing more. Its status chips are Open, Reviewing, Paid, Repaired and Denied. Paid takes the amount
  claimed to start, with **Paid to them** to change it. **New damage claim** adds one: the item (the job's items
  are suggested), what happened, the amount claimed and who it's from.
- **The crew lead's card** on a running or finished job has **Report damage**: what was damaged and what happened,
  then **Tell the office**. It adds a claim from the crew, and they're reminded to take a Damage photo.
- **The customer app**, for 30 days after the move's last day: **Report damage** on My move (what was damaged, what
  happened, about how much). They see each claim with where it stands: Sent, Being looked at, Paid $200, Repaired,
  Closed. The Edge Function's `cust_claim` takes it and allows five on a move. It texts the office when the company
  line is set up (**Options › Texts › Damage reports from customers**, on to start).
- **Today** shows every open claim ("Damage claim: Priya Nair · Dresser · $250 claimed · from the customer 2 hours
  ago").
- **Reports › Damage claims**: the open ones and what's claimed, the ones closed in the dates picked and what was
  paid, and how many by crew.

Data: `j.claims` (a map by id in the database, like the payments) of `{id, at, by, from, item, what, amt, status,
paid, closedAt, closedBy}`. The customer's copy has `claimsOn` and each claim's item, what, amount, status, paid and
when, but not who on the office side.

## Truck reminders

**Setup › Options › Truck reminders** (on to start). In **Setup › Fleet**, under each truck: Registration renews,
Insurance renews, Inspection due and Next service, as dates. The folded line says the next one ("Next: inspection,
Fri, Dec 4", or "Past due: ..." once it's past). Today shows each one to the owner and dispatch from 30 days before ("Box 1 (26 ft): registration is
due soon"), and in red once it's past. Tapping it opens Setup › Fleet. Data: `settings.trucks[i].regDue`, `insDue`,
`inspDue`, `svcDue`.

Tests: `tests/ui/claims.js` (both editions) and `tests/function/cust.ts`.
