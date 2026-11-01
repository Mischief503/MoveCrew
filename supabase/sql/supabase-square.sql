-- MoveCrew: card payments through a company's own Square account (Nov 1, 2026).
-- Run after supabase-payments.sql. Safe to run again. Nothing here removes or rewrites existing data
-- (Supabase may ask to confirm the one "drop constraint" below: it swaps a rule on pay_links, see there).
--
-- Richie: "For payment processing i would also like to add remedy and square card . There should be a
-- place where the company can link what they use then the app will auto use their connection for the
-- payment". The owner connects the company's Square account in Setup > Payments (on Square's own
-- sign-in page); from then on its card payments go through Square.
--
-- pay_square        each company's Square connection: the Square seller (merchant) and the location
--                   card payments are taken at, and the tokens Square gave MoveCrew for it, encrypted by
--                   the Edge Function with a key made from SQUARE_APP_SECRET (this table never holds a
--                   token in the clear). active = the company takes cards through Square (off: through
--                   Stripe, as before). One current connection per company and mode; a disconnected one
--                   stays on file for its old payments' refunds.
-- pay_links.meta    what a Square payment link needs remembered: its order (how a payment on it is
--                   found) and a customer's tip.
--
-- Square's payments, links, cards on file and customers go in the same tables as Stripe's, with the
-- account "sq:<merchant id>", so what is owed, the one-payment-at-a-time lock and the history work the
-- same for both.
--
-- Only the Edge Function (service role) touches these: row level security is on and there are no
-- policies, so the app can neither read nor write them directly.

create table if not exists public.pay_square (
  org_id         uuid not null references public.orgs(id) on delete cascade,
  merchant_id    text not null check (merchant_id ~ '^[A-Za-z0-9_-]{4,64}$'),
  livemode       boolean not null default false,
  is_current     boolean not null default true,
  active         boolean not null default true,
  status         text not null default 'ready' check (status in ('ready','revoked','no-location')),
  location_id    text not null default '',
  location_name  text not null default '',
  business_name  text not null default '',
  access_enc     text not null default '',
  refresh_enc    text not null default '',
  expires_at     timestamptz,
  created_by     text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (org_id, merchant_id, livemode)
);
-- one connection at a time per company and mode
create unique index if not exists pay_square_current_idx on public.pay_square(org_id, livemode) where is_current;
-- a Square event names the seller it is about
create index if not exists pay_square_merchant_idx on public.pay_square(merchant_id);

alter table public.pay_links add column if not exists meta jsonb not null default '{}'::jsonb;
create index if not exists pay_links_order_idx on public.pay_links((meta->>'order_id'));

-- A customer's page for a tip alone (Oct 28: the bill already paid, the customer tips the crew afterwards)
-- counts nothing toward the bill, so its amount is 0. supabase-payments.sql only allowed more than 0, which
-- refused those pages; this allows 0 (never less). It changes a rule, not any data.
alter table public.pay_links drop constraint if exists pay_links_amount_cents_check;
alter table public.pay_links add constraint pay_links_amount_cents_check check (amount_cents >= 0);

alter table public.pay_square enable row level security;
revoke all on public.pay_square from anon, authenticated;
grant all on public.pay_square to service_role;
