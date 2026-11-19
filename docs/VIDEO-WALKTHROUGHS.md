# Video walk-throughs

Richie, Nov 18: "The walk through videos should be saved to the crew notes so they can veiw it and see what they are in
for." He then picked **MoveCrew runs the call** and **Delete 30 days after move**.

## What happens

1. **Set it.** In Sales, a lead's **Walk-through** sets a video or voice call walk-through for a day and time (batch 6,
   Nov 17). A video one also gets its own link. With **Text Sam the time** ticked, the text carries the link:
   > Ace Moving: Hi Sam, your video walk-through is set for Wed, Nov 18 at 10:00 AM. At that time, open this link on
   > your phone to join: https://…/walk.html?w=… Dee will be on the call, so be ready to show us what's moving. Reply
   > here to change the time.
2. **Start it.** At the time, whoever takes it taps **Start video call** on the lead's card. The button turns yellow
   10 minutes before. You can also start one right away from the Walk-through panel (**Start the video call now**).
   The call screen shows the link, with **Copy**, **Text Sam the link** (from the company line) and **Text from my
   phone**.
3. **Sam joins.** The link opens a page on Sam's phone. There's no app and no sign-in. The page shows the company's
   name, who the call is with, and that **the call is recorded so the moving crew can see what's moving**. He taps
   **Turn on my camera and join**, and the back camera comes on. He can flip the camera, mute and hang up. He can open
   the link before you start; it connects once you do. The customer app also shows **Join the video walk-through**
   from half an hour before.
4. **The call.** You see and hear Sam, and he hears you. Your own camera stays off unless you tap **My camera**. The
   Android app uses the microphone only. While it records, both screens say **Recording**. **Hide** keeps the call
   going in a bar at the top while you use the rest of MoveCrew, for example to look at the quote.
5. **The video.** MoveCrew records Sam's camera with both voices at about 4 MB a minute, in parts of up to 8 minutes,
   for up to an hour per call. When you tap **End call**, it says "Saved to the crew notes: 12 min of video." A call
   that lasted 20 seconds or more marks the walk-through done ("Walk-through done (video call, 12 min), by Dee").
6. **The crew watches it.** Once the move is booked, the crew on the job sees **Walk-through video** in **Notes for the
   job** on their card, with **Watch**. The office sees it on the job sheet under **Job notes**; when that section is
   folded, it says "walk-through video". Only the owner and dispatch can **Delete** a video.

## Who can do what

- **Run a call:** the owner, dispatch and the call center (MoveCrew's team, or the company's own call center people).
  It works on open leads, quotes and booked moves.
- **Watch:** the owner and dispatch on any job, the crew on that job, and the call center while the job is open. Every
  watch link is checked by the server and lasts 3 hours.
- **Delete:** the owner and dispatch.

## Where the videos live, and for how long

- They're kept in the private **walk-videos** storage bucket in Supabase. Nobody reads that bucket directly. The Edge
  Function hands out one link at a time after checking who's asking.
- **30 days after the move is paid**, its videos are deleted. The same goes 30 days after a lead is marked lost, and
  for files whose job is gone. The office's MoveCrew asks for this clean-up at most every 12 hours. The evening cron
  does it too, once it's set up (SETUP-twilio.md, 4b).
- **The free plan has 1 GB of storage in all**, and 5 GB of watching a month. MoveCrew stops taking new videos when
  storage reaches 800 MB. The call still works; it just isn't saved, and the call screen says so. If you move
  Supabase to a paid plan (Pro: 100 GB), raise the limit: **Edge Functions › Secrets**, `WALK_CAP_MB` (for example
  `80000`).

## Setting it up

- **Database:** `supabase/sql/supabase-walk.sql` makes the bucket, the call's room table and the storage count. It's
  safe to run again.
- **Twilio (recommended):** phones on cell data often need a relay to connect. With `TWILIO_ACCOUNT_SID` and
  `TWILIO_AUTH_TOKEN` in the Edge Function's secrets (the same ones the company line uses), MoveCrew uses Twilio's
  relay, which costs a few cents a call at most. Without them, a public STUN server is used, which works on most Wi-Fi.
- **Apps:** the website, the Windows app and iPhones (the website) can run calls. The Android app asks for the
  microphone the first time.

## How it works (for the next person)

- The call is WebRTC, straight between the two devices. The Edge Function only passes the offer and the answer, which
  wait in `walk_rooms` (one row per job). The office's MoveCrew sends the offer when the customer is there. The
  customer's page polls every 1.5 seconds and answers.
- The link's code is `<company>.<job>.<room>`. The room is `survey.room`, made by the app when a video walk-through is
  set. The room table keeps only a hash of it. The customer's actions (POST `/walk`) check the code against the job
  and allow 150 a minute per link.
- The recording happens on the office's side (MediaRecorder: MP4 with H.264 where the browser has it, otherwise WebM).
  Each part goes to storage through a signed link (`walk_part`); then `walk_saved` checks that it's there and puts it
  on the job (`j.walkVids`, one key per part, like photos). The app never writes that key itself.
- Tests: `tests/function/walk.ts` (the server), `tests/ui/walkvideo.js` (the app), `tests/ui/walkcall.js` (a real call
  between two Chromium pages), and `tests/sql/walk.sh`.
