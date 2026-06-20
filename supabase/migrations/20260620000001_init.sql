-- AdFunded AI — initial schema (Supabase / PostgreSQL)
-- Replaces the former Prisma schema. Column names are kept in camelCase
-- (matching the app's field names) so API response shapes are unchanged.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type "Role" as enum ('USER', 'ADVERTISER', 'ADMIN');
create type "CampaignStatus" as enum ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');
create type "AdType" as enum ('VIDEO', 'IMAGE', 'INTERACTIVE');
create type "AdViewStatus" as enum ('STARTED', 'COMPLETED', 'ABANDONED');
create type "PayoutStatus" as enum ('PENDING', 'PAID', 'FAILED', 'SIMULATED');
create type "MessageRole" as enum ('USER', 'ASSISTANT', 'SYSTEM');

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table "User" (
  id            uuid primary key default gen_random_uuid(),
  "walletAddress" text unique not null,
  email         text,
  "displayName" text,
  role          "Role" not null default 'USER',
  "totalRewards" numeric(18, 6) not null default 0,
  "totalViews"  integer not null default 0,
  "createdAt"   timestamptz not null default now(),
  "updatedAt"   timestamptz not null default now()
);
create index "User_role_idx" on "User" (role);
create trigger "User_set_updated_at" before update on "User"
  for each row execute function set_updated_at();

create table "Advertiser" (
  id               uuid primary key default gen_random_uuid(),
  "userId"         uuid unique not null references "User"(id) on delete cascade,
  "companyName"    text not null,
  "contactEmail"   text,
  website          text,
  "treasuryBalance" numeric(18, 6) not null default 0,
  "totalDeposited" numeric(18, 6) not null default 0,
  "totalSpent"     numeric(18, 6) not null default 0,
  "createdAt"      timestamptz not null default now(),
  "updatedAt"      timestamptz not null default now()
);
create trigger "Advertiser_set_updated_at" before update on "Advertiser"
  for each row execute function set_updated_at();

create table "Campaign" (
  id              uuid primary key default gen_random_uuid(),
  "advertiserId"  uuid not null references "Advertiser"(id) on delete cascade,
  name            text not null,
  description     text,
  status          "CampaignStatus" not null default 'ACTIVE',
  budget          numeric(18, 6) not null,
  spent           numeric(18, 6) not null default 0,
  "rewardPerView" numeric(18, 6) not null,
  impressions     integer not null default 0,
  completions     integer not null default 0,
  "createdAt"     timestamptz not null default now(),
  "updatedAt"     timestamptz not null default now()
);
create index "Campaign_advertiserId_idx" on "Campaign" ("advertiserId");
create index "Campaign_status_idx" on "Campaign" (status);
create trigger "Campaign_set_updated_at" before update on "Campaign"
  for each row execute function set_updated_at();

create table "Ad" (
  id            uuid primary key default gen_random_uuid(),
  "campaignId"  uuid not null references "Campaign"(id) on delete cascade,
  type          "AdType" not null default 'IMAGE',
  title         text not null,
  description   text,
  "mediaUrl"    text not null,
  "durationSec" integer not null default 10,
  "ctaText"     text,
  "ctaUrl"      text,
  "createdAt"   timestamptz not null default now()
);
create index "Ad_campaignId_idx" on "Ad" ("campaignId");

create table "AdView" (
  id            uuid primary key default gen_random_uuid(),
  "adId"        uuid not null references "Ad"(id) on delete cascade,
  "campaignId"  uuid not null references "Campaign"(id) on delete cascade,
  "userId"      uuid not null references "User"(id) on delete cascade,
  status        "AdViewStatus" not null default 'STARTED',
  "rewardAmount" numeric(18, 6) not null default 0,
  "platformFee" numeric(18, 6) not null default 0,
  "userReward"  numeric(18, 6) not null default 0,
  "payoutStatus" "PayoutStatus" not null default 'PENDING',
  "txHash"      text,
  "proofToken"  text unique not null,
  "proofUsed"   boolean not null default false,
  "startedAt"   timestamptz not null default now(),
  "completedAt" timestamptz
);
create index "AdView_userId_idx" on "AdView" ("userId");
create index "AdView_campaignId_idx" on "AdView" ("campaignId");
create index "AdView_status_idx" on "AdView" (status);

create table "Reward" (
  id            uuid primary key default gen_random_uuid(),
  "userId"      uuid not null references "User"(id) on delete cascade,
  "adViewId"    uuid unique not null references "AdView"(id) on delete cascade,
  amount        numeric(18, 6) not null,
  "txHash"      text,
  status        "PayoutStatus" not null default 'PENDING',
  "walletAddress" text not null,
  "createdAt"   timestamptz not null default now()
);
create index "Reward_userId_idx" on "Reward" ("userId");

create table "TreasuryDeposit" (
  id             uuid primary key default gen_random_uuid(),
  "advertiserId" uuid not null references "Advertiser"(id) on delete cascade,
  amount         numeric(18, 6) not null,
  "txHash"       text,
  status         "PayoutStatus" not null default 'SIMULATED',
  "createdAt"    timestamptz not null default now()
);
create index "TreasuryDeposit_advertiserId_idx" on "TreasuryDeposit" ("advertiserId");

create table "PlatformRevenue" (
  id          uuid primary key default gen_random_uuid(),
  source      text not null default 'ad_fee',
  amount      numeric(18, 6) not null,
  "adViewId"  uuid,
  "createdAt" timestamptz not null default now()
);

create table "Conversation" (
  id          uuid primary key default gen_random_uuid(),
  "userId"    uuid not null references "User"(id) on delete cascade,
  title       text not null default 'New conversation',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index "Conversation_userId_idx" on "Conversation" ("userId");
create trigger "Conversation_set_updated_at" before update on "Conversation"
  for each row execute function set_updated_at();

create table "Message" (
  id               uuid primary key default gen_random_uuid(),
  "conversationId" uuid not null references "Conversation"(id) on delete cascade,
  role             "MessageRole" not null,
  content          text not null,
  model            text,
  "tokensIn"       integer not null default 0,
  "tokensOut"      integer not null default 0,
  "adViewId"       uuid unique references "AdView"(id),
  "createdAt"      timestamptz not null default now()
);
create index "Message_conversationId_idx" on "Message" ("conversationId");

-- ---------------------------------------------------------------------------
-- RPC: open_ad_view
-- Inserts an AdView (impression) and bumps the campaign impression counter
-- atomically. Returns the new view id.
-- ---------------------------------------------------------------------------
create or replace function open_ad_view(
  p_ad_id       uuid,
  p_campaign_id uuid,
  p_user_id     uuid,
  p_reward      numeric,
  p_proof_token text
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into "AdView" ("adId", "campaignId", "userId", status,
                        "rewardAmount", "platformFee", "userReward", "proofToken")
  values (p_ad_id, p_campaign_id, p_user_id, 'STARTED',
          p_reward, p_reward / 2, p_reward / 2, p_proof_token)
  returning id into v_id;

  update "Campaign"
    set impressions = impressions + 1
    where id = p_campaign_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: complete_ad_view
-- The money path. Validates the view, applies the full ledger update in one
-- transaction, and returns a jsonb result the API route can map to HTTP.
-- Does NOT perform the on-chain payout — the route does that, then writes the
-- resulting txHash/status back via mark_payout.
-- ---------------------------------------------------------------------------
create or replace function complete_ad_view(
  p_view_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_view        "AdView"%rowtype;
  v_duration    integer;
  v_advertiser  uuid;
  v_elapsed     numeric;
  v_total       numeric;
  v_user_reward numeric;
  v_platform    numeric;
  v_wallet      text;
  v_spent       numeric;
  v_budget      numeric;
  v_rpv         numeric;
begin
  select * into v_view from "AdView" where id = p_view_id for update;

  if not found or v_view."userId" <> p_user_id then
    return jsonb_build_object('error', 'view_not_found');
  end if;

  if v_view.status = 'COMPLETED' then
    return jsonb_build_object('ok', true, 'alreadyCompleted', true,
                              'proofToken', v_view."proofToken");
  end if;

  select "durationSec" into v_duration from "Ad" where id = v_view."adId";

  v_elapsed := extract(epoch from (now() - v_view."startedAt"));
  if v_elapsed < v_duration - 3 then
    return jsonb_build_object('error', 'ad_not_completed', 'needSec', v_duration);
  end if;

  v_total       := v_view."rewardAmount";
  v_user_reward := v_view."userReward";
  v_platform    := v_view."platformFee";

  update "AdView"
    set status = 'COMPLETED', "completedAt" = now()
    where id = v_view.id;

  update "Campaign"
    set spent = spent + v_total, completions = completions + 1
    where id = v_view."campaignId"
    returning "advertiserId", spent, budget, "rewardPerView"
    into v_advertiser, v_spent, v_budget, v_rpv;

  update "Advertiser"
    set "treasuryBalance" = "treasuryBalance" - v_total,
        "totalSpent" = "totalSpent" + v_total
    where id = v_advertiser;

  update "User"
    set "totalRewards" = "totalRewards" + v_user_reward,
        "totalViews" = "totalViews" + 1,
        "walletAddress" = "walletAddress"
    where id = p_user_id
    returning "walletAddress" into v_wallet;

  insert into "PlatformRevenue" (source, amount, "adViewId")
  values ('ad_fee', v_platform, v_view.id);

  insert into "Reward" ("userId", "adViewId", amount, "walletAddress", status)
  values (p_user_id, v_view.id, v_user_reward, v_wallet, 'PENDING');

  -- Exhaust the campaign if it can no longer fund another reward.
  if v_spent + v_rpv > v_budget then
    update "Campaign" set status = 'COMPLETED' where id = v_view."campaignId";
  end if;

  return jsonb_build_object(
    'ok', true,
    'proofToken', v_view."proofToken",
    'userReward', v_user_reward,
    'platformFee', v_platform,
    'walletAddress', v_wallet
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: mark_payout
-- Writes the on-chain settlement result back to the AdView + Reward.
-- ---------------------------------------------------------------------------
create or replace function mark_payout(
  p_view_id uuid,
  p_status  text,
  p_tx_hash text
)
returns void
language plpgsql
as $$
begin
  update "AdView"
    set "payoutStatus" = p_status::"PayoutStatus", "txHash" = p_tx_hash
    where id = p_view_id;
  update "Reward"
    set status = p_status::"PayoutStatus", "txHash" = p_tx_hash
    where "adViewId" = p_view_id;
end;
$$;
