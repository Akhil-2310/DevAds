-- DevAds — CLI auth token. The CLI registers a wallet and receives an opaque
-- token; it sends that token as the Anthropic x-api-key to the coordinator's
-- gateway proxy, which maps it back to the wallet, checks credits, and swaps in
-- the real ANTHROPIC_API_KEY before forwarding to api.anthropic.com.

alter table "User"
  add column if not exists "cliToken" text unique;

-- Register (or re-register) a wallet for CLI use; returns the issued token.
create or replace function register_cli(p_wallet text, p_token text)
returns jsonb
language plpgsql
as $$
declare
  v_user uuid;
  v_credits integer;
begin
  v_user := ensure_user(p_wallet, 'USER');
  update "User" set "cliToken" = p_token where id = v_user
    returning "creditsRemaining" into v_credits;
  return jsonb_build_object('wallet', p_wallet, 'token', p_token, 'credits', v_credits);
end;
$$;
