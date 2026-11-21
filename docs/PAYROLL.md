# Payroll

Richie, Nov 20: "How does employee hours get logged and can we make it so it is a fast export in spreadsheets to send
to the payroll company". Then, on pay periods and overtime: "Give the company choices for payroll how often they pay
employees. What classifys as overtime, over 8 in a day, over 40 in a week. This should be under hr responsibility. So
employees should have a place in their profile to switch on hr responsibility just like lead or sales responsibility."
And on tips: "Give the companys coices on how they handle tips. They may ask the crew lead what the split should be. Or
they may have a standard policy of by the hours worked on the job for jobs where someone is added."

## How hours get logged

- **The time clock.** The crew clock in and out on the clock card (Today, and the top of the crew's Jobs screen), for
  job days, warehouse work, dump runs and the rest. Breaks are unpaid. Clocking out long after the day's last job can
  ask for a note (Options › Note for late clock-outs).
- **Time on a job.** When a job starts, everyone on it who is clocked in goes on the job; anyone who clocks in later
  goes on then, and clocking out takes them off. When a lead adds or takes off a mover partway (Options › Crew leads add
  movers on site), those times count too.
- **A day's hours** for a person are their time clock hours that day. On a day they didn't use the clock, it's their
  time on that day's finished jobs.
- **The minimum.** When a job runs shorter than its minimum (Rate card › Minimum hours, with Options › Pay the minimum
  hours on), the top-up pays the rest of it, per person: someone who joined a 3-hour-minimum job for its last hour gets
  a 2-hour top-up. The top-up is paid at the regular rate and isn't time worked, so it never makes overtime.

Reports › Employee hours shows the same numbers for any days you pick.

## Who sees Payroll: HR

- **The owner** always has it.
- **Anyone else** with the **HR** switch on their profile (Setup › Employees, under What they see, beside Field view,
  Dispatch and Call center). A crew member, a lead, dispatch or the call center can have HR too. Someone with HR alone
  (a bookkeeper, say) sees just Payroll and Chat.
- Payroll is in **More › Payroll** (a tab of its own on a computer, and for HR alone).

## Payroll settings (HR)

At the bottom of Payroll, open until they're saved the first time:

- **How often you pay:** weekly, every 2 weeks (from the first day of any pay period), twice a month (the 1st to the
  15th, and the 16th to the end of the month) or monthly.
- **The workweek starts on:** the day weekly overtime counts from.
- **What counts as overtime:** over a number of hours in a week (40 to start), over a number of hours in a day (8, off
  to start), or both. With both on, a day's overtime hours don't count again toward the week. The payroll company pays
  overtime at time and a half.
- **Tips:**
  - **By hours on the job** (to start): each mover's share follows their time on the job, so it's even unless someone
    joined late or left early.
  - **Evenly:** the same share for everyone on the job.
  - **The crew lead splits it:** the lead puts in each mover's share on the job card (**Split the tip**, by the tip on
    the bill). Until they do, it's split evenly, and Payroll says so. HR can split it in Payroll too.
  - **Leave tips out:** tips are paid some other way, so they're not in the payroll file.

  A tip counts in the pay period it was paid in. Shares are worked out to the cent and always add up to the tip.

## The pay period

Payroll opens on **the last pay period** (the one that ended most recently). **‹ ›** step to the ones before, and to
this one so far.

**Check before you send** lists what to look at first:
- someone **still clocked in** (Fix: put in when they clocked out)
- a shift of **14 hours or more** (Check)
- **two clock-ins at once** for one person
- a tip **not split yet**, or one that came in after the lead split it (Split)
- a tip on a job with **nobody on the crew**
- **no payroll ID** for someone, once anyone has one (Add)
- a move **not finished yet**, whose hours aren't in for anyone who didn't clock in

**Hours** (and tips and commission, when there are any): each person's regular hours, overtime, top-up and total, with
their tips and commission. Tap a name for each day.

**Clock punches** lists every clock-in and clock-out in the period. **Fix** changes a clock-in or clock-out (each fix
keeps who made it, when, and what it was). **Take this shift out** (tapped twice) takes a wrong one out of the hours;
it's kept, marked, not deleted. **Add a missed shift** puts in one someone forgot.

**Payroll IDs:** each person's ID at the payroll company, so the file matches their records. It's on their profile too
(Setup › Employees › Job and pay).

## The files

- **The Excel file** (.xlsx) has a sheet for:
  - **Payroll summary:** each person's payroll ID, worker type, pay type, regular hours, overtime hours, minimum top-up
    hours and total hours, and their tips and commission; the totals; what it all means
  - **By day:** each person's day, from the clock or the jobs, regular and overtime
  - **Clock punches:** every clock-in and clock-out, breaks, and notes (fixed, added, still clocked in, late)
  - **Tips:** each tip and each person's share
  - **Commission**, when there is some (Setup › Sales commission): the moves paid in full in the period
- **The CSV** is the summary alone, one row a person, for a payroll company that imports a file.

On a phone the buttons say **Send**: the phone's share sheet opens (email, Drive, a text). The Android app does the same
through Android's share sheet; the Android app from before payroll says to update it. On a computer and in the Windows
app they download (the Windows app asks where to save, starting in Downloads). The copy in claude.ai can't hand out
files, so it has **Copy the summary** and **Copy each day** instead, to paste into a spreadsheet.

The file names say the company and the days: `ace-moving-payroll-2026-11-09-to-2026-11-22.xlsx`.

## Setting it up

- **Database:** run `supabase/sql/supabase-payroll.sql` once in the Supabase SQL editor (after
  `supabase-callcenter.sql`). It's safe to run again. It lets HR read and fix everyone's clock rows, and adds the
  functions HR who aren't the owner or dispatch use: `payroll_jobs` (a pay period's jobs), `payroll_people` (each
  profile's payroll ID, worker type and pay type, never the pay rate or the owner's notes), `hr_payroll_set` (the
  settings), `hr_tip_split` (a tip split on a job they aren't on) and `hr_payroll_id`. Each checks the person has HR.
  On a job, only the office, HR or a lead on it can change the tip split (`tips_guard`).
- **The apps:** the Android app needs its new version to send the file (the share sheet). The website, the Windows app
  and iPhones (the website) work as they are.

## How it works (for the next person)

- HR is the owner, or a name in the settings' `hr` list. The owner's app keeps the list from the profiles' HR switch
  (`dirApply`), and the database reads it (`hr_of`).
- The settings are `settings.payroll`: `{freq, anchor, weekStart, otWeekOn, otWeek, otDayOn, otDay, tips, set, by, at}`.
  The owner saves them with the rest of the settings; anyone else with HR through `hr_payroll_set`.
- A tip split is `job.tipSplit`: `{amts: {name: dollars}, total, by, at}`. The lead saves it with the job; HR who
  can't write the job, through `hr_tip_split`.
- A clock row HR fixed has `fixes: [{by, at, inAt, outAt}]` (what it was); one they added has `added: {by, at}`; one
  taken out has `void: {by, at}` and counts for nothing (`shiftMs` is 0).
- Everything is worked out in the app (`payrollData`): no server change. The Excel file is written in the app too
  (`xlsxBook`: the sheets as XML in a zip, stored without compression).
- Tests: `tests/ui/payroll.js` (the claude.ai copy: the numbers, the screens, the files), `tests/ui/payroll-hosted.js`
  (HR through the database's functions, and the files leaving the app), `tests/sql/payroll.sh` (the rules and
  functions), and `tests/windows/rules.js` (what the Windows app downloads).
