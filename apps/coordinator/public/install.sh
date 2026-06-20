#!/bin/sh
# DevAds installer — configures this machine's consumer wallet.
# Usage:  curl -fsSL <host>/install.sh | sh -s -- --wallet 0xYOURADDRESS
set -e

WALLET=""
while [ $# -gt 0 ]; do
  case "$1" in
    --wallet) WALLET="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [ -z "$WALLET" ]; then
  echo "error: missing --wallet 0x..." >&2
  exit 1
fi

CFG_DIR="$HOME/.devads"
mkdir -p "$CFG_DIR"
printf '{\n  "wallet": "%s"\n}\n' "$WALLET" > "$CFG_DIR/config.json"

echo ""
echo "  ▮ DevAds configured"
echo "    wallet : $WALLET"
echo "    config : $CFG_DIR/config.json"
echo ""
echo "  Start earning:  devads            # code + watch ads"
echo "             or:  devads watch      # just the earn loop"
echo ""
