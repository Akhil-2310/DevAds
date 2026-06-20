-- DevAds — credits + claim/settlement bridge.
-- Adds a free-usage credit balance to User and the atomic money-path RPCs the
-- coordinator's store calls: consume_credit (gateway proxy debits a turn),
-- record_claim (CLI files a watch claim → grants credits + a pending reward),
-- settle_claim (paymaster's x402 payout lands → full ledger update).

-- ---------------------------------------------------------------------------
-- Free-usage credits: each completed ad-view grants N agent turns.
-- ---------------------------------------------------------------------------
alter table "User"
  add column if not exists "creditsRemaining" integer not null default 0;

-- Upsert a user by wallet address; returns the row id.
create or replace function ensure_user(p_wallet text, p_role "Role" default 'USER')
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into "User" ("walletAddress", role)
  values (p_wallet, p_role)
  on conflict ("walletAddress") do update set "walletAddress" = excluded."walletAddress"
  returning id into v_id;
  return v_id;
end;
$$;

-- Atomically spend one credit. Returns remaining count, or -1 if none left.
create or replace function consume_credit(p_wallet text)
returns integer
language plpgsql
as $$
declare
  v_remaining integer;
begin
  select "creditsRemaining" into v_remaining
    from "User" where "walletAddress" = p_wallet for update;
  if v_remaining is null or v_remaining <= 0 then
    return -1;
  end if;
  update "User" set "creditsRemaining" = "creditsRemaining" - 1
    where "walletAddress" = p_wallet;
  return v_remaining - 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_claim — the CLI watched an ad to completion. Validate budget, record
-- the AdView (proofToken = anti-replay nonce), open a PENDING reward, and grant
-- the viewer free-usage credits. Does NOT pay on-chain (the paymaster does that
-- via x402, then calls settle_claim). Returns the claim shape the API serves.
-- ---------------------------------------------------------------------------
create or replace function record_claim(
  p_ad_id   uuid,
  p_wallet  text,
  p_nonce   text,
  p_credits integer
)
returns jsonb
language plpgsql
as $$
declare
  v_campaign uuid;
  v_rpv      numeric;
  v_budget   numeric;
  v_spent    numeric;
  v_status   "CampaignStatus";
  v_user     uuid;
  v_view     uuid;
begin
  select "campaignId" into v_campaign from "Ad" where id = p_ad_id;
  if v_campaign is null then
    return jsonb_build_object('error', 'unknown ad');
  end if;

  select "rewardPerView", budget, spent, status
    into v_rpv, v_budget, v_spent, v_status
    from "Campaign" where id = v_campaign for update;
  if v_status <> 'ACTIVE' or v_spent + v_rpv > v_budget then
    return jsonb_build_object('error', 'campaign out of budget');
  end if;

  v_user := ensure_user(p_wallet, 'USER');

  insert into "AdView" ("adId", "campaignId", "userId", status,
                        "rewardAmount", "platformFee", "userReward",
                        "proofToken", "completedAt")
  values (p_ad_id, v_campaign, v_user, 'COMPLETED',
          v_rpv, v_rpv / 2, v_rpv / 2, p_nonce, now())
  returning id into v_view;

  insert into "Reward" ("userId", "adViewId", amount, "walletAddress", status)
  values (v_user, v_view, v_rpv / 2, p_wallet, 'PENDING');

  update "User" set "creditsRemaining" = "creditsRemaining" + p_credits
    where id = v_user;

  return jsonb_build_object(
    'id', v_view,
    'adId', p_ad_id,
    'consumerWallet', p_wallet,
    'sessionNonce', p_nonce,
    'rewardAmount', v_rpv,
    'status', 'pending',
    'createdAt', extract(epoch from now()) * 1000
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- settle_claim — the paymaster's x402 transfer settled on Monad. Mark the view
-- + reward PAID, draw down the campaign budget and advertiser treasury, credit
-- the user's lifetime rewards, and book platform revenue — all in one tx.
-- ---------------------------------------------------------------------------
create or replace function settle_claim(p_view_id uuid, p_tx text)
returns void
language plpgsql
as $$
declare
  v_view "AdView"%rowtype;
  v_adv  uuid;
  v_spent numeric;
  v_budget numeric;
  v_rpv numeric;
begin
  select * into v_view from "AdView" where id = p_view_id for update;
  if not found or v_view."payoutStatus" = 'PAID' then
    return;
  end if;

  update "AdView"
    set "payoutStatus" = 'PAID', "txHash" = p_tx, "proofUsed" = true
    where id = p_view_id;
  update "Reward"
    set status = 'PAID', "txHash" = p_tx
    where "adViewId" = p_view_id;

  update "Campaign"
    set spent = spent + v_view."rewardAmount", completions = completions + 1
    where id = v_view."campaignId"
    returning "advertiserId", spent, budget, "rewardPerView"
    into v_adv, v_spent, v_budget, v_rpv;

  update "Advertiser"
    set "treasuryBalance" = "treasuryBalance" - v_view."rewardAmount",
        "totalSpent" = "totalSpent" + v_view."rewardAmount"
    where id = v_adv;

  update "User"
    set "totalRewards" = "totalRewards" + v_view."userReward",
        "totalViews" = "totalViews" + 1
    where id = v_view."userId";

  insert into "PlatformRevenue" (source, amount, "adViewId")
  values ('ad_fee', v_view."platformFee", p_view_id);

  if v_spent + v_rpv > v_budget then
    update "Campaign" set status = 'COMPLETED' where id = v_view."campaignId";
  end if;
end;
$$;
