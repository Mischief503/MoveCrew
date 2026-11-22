# Moves over more than one day

Batch 10 (Nov 22), from Richie's list of what MoveCrew was missing: moves over more than one day. That covers
loading one day and delivering the next, or a big job across several days. Each day is on the schedule with the truck
held overnight, and the bill and the crew's pay count each day's hours, not the night in between.
**Setup › Options › Moves over more than one day** (on to start) turns it on.

## On the quote

Under the date and start time, **Days**: One day to 5 days. Each day after the first gets its own date (the next day
to start) and start time (the same time to start). The quote's hours are shared out over the days, to the half hour,
the last day the rest: 7.5 hours over two days is 4 and 3.5.

The price is the same as a one-day move: the hours are the hours. Options › Moves over more than one day has a night
fee, **Truck held overnight, per truck each night**, $0 to start; set it and the quote adds "Truck held overnight:
1 night" at that price for each truck.

The day under the price shows day 1 to put in a slot, as before, then a timeline for each later day with whether it
fits. **Book job** checks every day, and says which day doesn't fit ("Day 2 (Wed, Dec 2): Every slot big enough has a
move then …"), with **Book anyway** for the office.

## On the schedule

The job is on each of its days with that day's start and hours ("day 2 of 2" on the Board and in Today). Its truck
stays loaded overnight, so it's taken to the end of every day but the last, and from the start of every day but the
first. A job in that truck the evening of day 1 is double-booked. The crew is free once each day's work is done.

The job sheet's Schedule has **Days** and each day's date and start, saved as you change them (and in the activity).

## On the job

The crew lead starts the job on day 1 as usual. When the day's work is done they tap **End day 1**, beside the next
step. The job stops for the night: everyone on it is off the job, and clocking in the next morning doesn't put them
back on it. The card says "Day 1 done, back tomorrow at 8:00 AM. The clock is stopped overnight." and has
**Start day 2**, which puts everyone clocked in back on the job. The office can also tap Start day 2 on the job sheet.
There's no End the day on the last day: they finish the job as usual. If a move needs another day, the office adds it
on the job sheet first.

The bill by the clock leaves the nights out: each day is its own row with its day ("Tue, Dec 1, 8:30 AM to 3:00 PM").
On-site times show each step without the night, and a row for each night. The crew's pay counts each person's own
time on the job, so the nights aren't paid either. The crew lead's new quote on site is for one-day moves: the
office changes a longer one.

## For the customer

Their app says "2-day move: Tue, Dec 1, Wed, Dec 2" under the day.

## Data

| Field | |
|---|---|
| `d.days` | The days after the first, `[{date, time}]` (day 1 is `d.moveDate` and `d.time`) |
| `pauses` | Each night, `[{from, to, by, toBy}]` |
| Settings `opt.multiDay`, `nightFee` | |

The helpers: `jobDays`, `onDate`, `splitHours`, `dayHoursOf`, `daySpans` (each day's work `s`–`e` and the truck held
`hs`–`he`), `blockOfDay`, `endDay`, `resumeDay`, `jobPaused`, `dayNow`, `minusPauses`.

**The database:** the schedule's copy that the call center reads (`sched_of`) keeps `days` from
`supabase/sql/supabase-multiday.sql`. Until that has been run on the live database, the call center's day plan sees a
move on its first day only. The office's own screens don't need it.

Tests: `tests/ui/multiday.js` (both editions), `tests/function/cust.ts`, `tests/sql/callcenter.sh`.
