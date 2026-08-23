# Binance-cli OpenClaw

A compact Binance Spot CLI wrapper skill for OpenClaw.

## What it does

This skill provides a single local entry point (`scripts/cli.mjs`) for four common operations:

1. Account info
2. Ticker price lookup
3. Spot order placement
4. Spot order status lookup

It reuses the existing `binance-cli` authentication/profile model documented in:

- [`../binance/references/auth.md`](../binance/references/auth.md)

## Install / setup

1. Install `binance-cli`.
2. Create/select a profile (or provide env vars supported by `binance-cli`).
3. Run this wrapper with Node.js.

## Commands

```bash
node scripts/cli.mjs account-info '{}'
node scripts/cli.mjs ticker-price '{"symbol":"BTCUSDT"}'
node scripts/cli.mjs order-place '{"symbol":"BTCUSDT","side":"BUY","type":"MARKET","quoteOrderQty":"25"}'
node scripts/cli.mjs order-status '{"symbol":"BTCUSDT","orderId":"123456"}'
# Optional account reference override for this command invocation only:
node scripts/cli.mjs account-info '{"binanceId":"115213344"}'
```

Use `profile` in params to target a non-active profile, for example:

```bash
node scripts/cli.mjs ticker-price '{"symbol":"BNBUSDT","profile":"prod-main"}'
```

Use `binanceId` (or alias `accountId` / `userId`) in params to override `BINANCE_ID`
for a single invocation without hardcoding account identifiers in source code.

## Dry run

To inspect the generated `binance-cli` command without executing it:

```bash
node scripts/cli.mjs ticker-price '{"symbol":"BTCUSDT"}' --dry-run
```
