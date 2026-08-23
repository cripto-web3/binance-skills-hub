import assert from "node:assert/strict";

import {
  buildBinanceCliArgs,
  buildBinanceCliInvocation,
} from "../skills/binance/binance-cli-openclaw/scripts/cli.mjs";

assert.deepEqual(buildBinanceCliArgs("account-info", {}), ["spot", "get-account"]);
assert.deepEqual(buildBinanceCliArgs("ticker-price", { symbol: "BTCUSDT" }), [
  "spot",
  "ticker-price",
  "--symbol",
  "BTCUSDT",
]);
assert.deepEqual(
  buildBinanceCliArgs("order-place", {
    symbol: "BTCUSDT",
    side: "BUY",
    type: "MARKET",
    quoteOrderQty: "25",
    profile: "prod-main",
  }),
  [
    "spot",
    "new-order",
    "--symbol",
    "BTCUSDT",
    "--side",
    "BUY",
    "--type",
    "MARKET",
    "--quote-order-qty",
    "25",
    "--profile",
    "prod-main",
  ],
);
assert.deepEqual(
  buildBinanceCliArgs("order-status", {
    symbol: "BTCUSDT",
    orderId: "123",
    recvWindow: 5000,
  }),
  [
    "spot",
    "get-order",
    "--symbol",
    "BTCUSDT",
    "--order-id",
    "123",
    "--recv-window",
    "5000",
  ],
);

assert.throws(
  () => buildBinanceCliArgs("order-place", { symbol: "BTCUSDT", side: "BUY", type: "MARKET" }),
  /quantity.*quoteOrderQty/,
);
assert.throws(() => buildBinanceCliArgs("ticker-price", {}), /symbol/);

const baseEnv = { PATH: "/usr/bin", BINANCE_ID: "existing" };
const invocationWithId = buildBinanceCliInvocation("account-info", { binanceId: "115213344" }, baseEnv);
assert.deepEqual(invocationWithId.args, ["spot", "get-account"]);
assert.equal(invocationWithId.env.BINANCE_ID, "115213344");
assert.equal(baseEnv.BINANCE_ID, "existing");
assert.equal(invocationWithId.hasBinanceIdOverride, true);

const invocationWithAliasId = buildBinanceCliInvocation("ticker-price", { symbol: "BTCUSDT", accountId: "7788" }, baseEnv);
assert.equal(invocationWithAliasId.env.BINANCE_ID, "7788");

assert.throws(
  () => buildBinanceCliInvocation("account-info", { userId: "   " }, baseEnv),
  /cannot be empty/,
);

console.log("binance-cli-openclaw:test passed");
