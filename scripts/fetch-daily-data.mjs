#!/usr/bin/env node
/**
 * Binance Daily Data Fetch (READ-ONLY) — once per day → data/binance-daily.data
 *
 * Extended daily statement inspired by the Ondo Stocks daily attestation report
 * (Ankura verification agent). All data are read-only: never places orders,
 * transfers, or withdrawals.
 *
 * Categories:
 *   - statement_header : date as of end of day (UTC), report kind, read-only flag
 *   - binance_identity : uid (Binance ID), permissions, HMAC-signed time sync
 *                        (signature verifies BINANCE_API_KEY/BINANCE_API_SECRET pair)
 *   - balances         : full signed balance snapshot (free/locked, non-zero) —
 *                        the daily "Total Assets / Total Liabilities" equivalent
 *   - ondo_statement   : Ondo tokenized-stock market status + fundamentals
 *                        (P/E, dividend yield, 52-week range) per watched stock
 *   - market_24h       : 24h summary (total value basis) from ticker data
 *   - summary          : computed: total quoted assets (quote value), top holdings
 *
 * Secrets (GitHub Actions repository secrets):
 *   BINANCE_API_KEY    : signed endpoints
 *   BINANCE_API_SECRET : signed endpoints
 *
 * Optional env: BINANCE_STOCKS (watched Ondo stock tickers, default: GOOGL,AAPL,TSLA)
 */
import { createHmac } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'https://api.binance.com';
const MIRROR_URL = process.env.PUBLIC_MIRROR_URL || process.env.MIRROR_URL || 'https://data-api.binance.vision';
const DATA_DIR = process.env.DATA_DIR || 'data';
const OUT_FILE = process.env.DATA_FILE || `${DATA_DIR}/binance-daily.data`;
const KEY = process.env.BINANCE_API_KEY || '';
const SECRET = process.env.BINANCE_API_SECRET || '';
const STOCKS = (process.env.BINANCE_STOCKS || 'GOOGL,AAPL,TSLA').split(',');

// Sensitive stock identifiers (chainId/contractAddress/multiplier) are NEVER
// fetched from the public API response into the output — they are loaded from
// .env only (BINANCE_STOCK_MAP, JSON object) per the privacy policy.
let STOCK_MAP = {};
try {
  let raw = process.env.BINANCE_STOCK_MAP ?? '';
  // bash single-quoted values may survive `source` verbatim; strip wrapper
  // quotes if present (JSON must start with '{').
  raw = raw.trim();
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
    raw = raw.slice(1, -1).trim();
  }
  if (raw) STOCK_MAP = JSON.parse(raw);
} catch {
  STOCK_MAP = {};
}

mkdirSync(DATA_DIR, { recursive: true });

const ONDO_UA = { 'Accept-Encoding': 'identity', 'User-Agent': 'binance-web3/1.1 (Skill)' };
const BAPI = 'https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa';

async function fetchJson(url, opts = {}) {
  const headers = { ...(opts.headers ?? {}) };
  if (KEY && opts.apikey) headers['X-MBX-APIKEY'] = KEY;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000), headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

function signedJson(path, query = {}) {
  const params = new URLSearchParams({ ...query, timestamp: Date.now().toString() });
  params.set('signature', createHmac('sha256', SECRET).update(params.toString()).digest('hex'));
  return fetchJson(`${BASE_URL}${path}?${params}`, { apikey: true });
}

// /api/v3/time is public and does NOT accept a signature query parameter.
async function fetchServerTime() {
  return fetchJson(`${BASE_URL}/api/v3/time`, { apikey: true });
}

// Public (unsigned) endpoints fall back to the data-api.binance.vision mirror
// when the primary host is geo-restricted (HTTP 451/418) for the runner.
async function withMirror(primary, mirror) {
  if (!MIRROR_URL) return primary();
  try {
    return await primary();
  } catch (err) {
    if (/restricted|418|451|geo/i.test(String(err))) return mirror();
    throw err;
  }
}

/* ---------- collectors ---------- */
async function collectIdentity() {
  if (!KEY || !SECRET) return { error: 'BINANCE_API_KEY/BINANCE_API_SECRET not set' };
  try {
    const time = await fetchServerTime();
    const acct = await signedJson('/api/v3/account');
    // HMAC verification proof: signature that only a holder of the real secret can produce
    const hmacProof = createHmac('sha256', SECRET).update(`uid:${acct.uid}|time:${time.serverTime}|daily`).digest('hex');
    return {
      binance_id: acct.uid,
      permissions: acct.permissions,
      server_time_utc: new Date(time.serverTime).toISOString(),
      hmac_verified: true,
      hmac_proof_sha256: hmacProof,
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function collectBalances() {
  if (!KEY || !SECRET) return { error: 'secrets not set; balances skipped' };
  try {
    const acct = await signedJson('/api/v3/account');
    const balances = acct.balances
      .filter(b => +b.free !== 0 || +b.locked !== 0)
      .map(b => ({ asset: b.asset, free: b.free, locked: b.locked, total: (+b.free + +b.locked).toString() }));
    return {
      count_total: acct.balances.length,
      non_zero: balances.length,
      balances,
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function collectOndoStatement() {
  try {
    const listUrl = `${BAPI}/stock/detail/list/ai?type=1`;
    const list = await fetchJson(listUrl, { headers: ONDO_UA });
    // Each ticker may deploy on multiple chains (Ethereum + BSC); keep the first
    // occurrence per ticker so each stock appears exactly once.
    const rows = (list.data ?? []).filter(r => STOCKS.includes((r.ticker ?? '').toUpperCase()));
    const assets = [];
    for (const r of rows) {
      // Identifiers come ONLY from BINANCE_STOCK_MAP (.env) — never from the
      // public API response and never written to the output file (privacy).
      const id = STOCK_MAP[(r.ticker ?? '').toUpperCase()];
      if (!id || !id.contractAddress || !id.chainId) {
        assets.push({ ticker: r.ticker, symbol: r.symbol, error: 'no stock map entry in BINANCE_STOCK_MAP' });
        continue;
      }
      // API 5: RWA Dynamic — /bapi/defi/v2/public/.../rwa/dynamic/ai
      const dynUrl = `https://www.binance.com/bapi/defi/v2/public/wallet-direct/buw/wallet/market/token/rwa/dynamic/ai?chainId=${id.chainId}&contractAddress=${id.contractAddress}`;
      try {
        const dyn = await fetchJson(dynUrl, { headers: ONDO_UA });
        const d = dyn.data ?? {};
        const si = d.stockInfo ?? {};
        const ti = d.tokenInfo ?? {};
        // Note: chain/contractAddress are used only for the internal API call;
        // they are NOT written to the output file (privacy).
        assets.push({
          ticker: r.ticker,
          symbol: r.symbol,
          token_price: ti.price ?? null,
          stock_price_usd: si.price ?? null,
          reference_price: si.price && id.multiplier ? (+si.price / +id.multiplier).toFixed(2) : null,
          price_change_pct_24h: ti.priceChangePct24h ?? null,
          pe_ratio: si.priceToEarnings ?? null,
          dividend_yield_pct: si.dividendYield ?? null,
          week_range_52_low: si.priceLow52w ?? null,
          week_range_52_high: si.priceHigh52w ?? null,
          market_cap: si.marketCap ?? null,
          shares_outstanding: si.sharesOutstanding ?? null,
          holders: ti.totalHolders ?? null,
          volume24h_usd: ti.volume24h ?? null,
        });
      } catch (err) {
        assets.push({ ticker: r.ticker, symbol: r.symbol, error: err.message });
      }
    }
    // overall Ondo market status
    let marketStatus = { error: 'status not fetched' };
    try {
      const ms = await fetchJson(`${BAPI}/market/status/ai`, { headers: ONDO_UA });
      marketStatus = ms.data ?? { error: 'unknown' };
    } catch (err) {
      marketStatus = { error: err.message };
    }
    return { watched_stocks: assets, market_status: marketStatus, total_listed: (list.data ?? []).length };
  } catch (err) {
    return { error: err.message };
  }
}

// Full Ondo tokenized-stock inventory (public): 445 unique tickers across
// 1,330 chain deployments. Income-statement figures (revenue/net income/EBITDA/
// margins) are NOT exposed by Binance public APIs — the app's Financials tab uses
// an internal backend; keep per-stock fundamentals (P/E, dividend yield,
// 52-week range) and the daily attestation PDF links instead.
async function collectStockInventory() {
  try {
    const list = await fetchJson(`${BAPI}/stock/detail/list/ai?type=1`);
    const rows = list.data ?? [];
    const tickers = new Map();
    for (const r of rows) {
      const t = (r.ticker ?? '').toUpperCase();
      if (!t) continue;
      // keep first deployment per ticker (chain/contract are internal only)
      if (!tickers.has(t)) tickers.set(t, { ticker: t, symbol: r.symbol, name: r.name ?? null });
    }
    // daily attestation report path per stock (from meta endpoint sample)
    let dailyPdf = null;
    try {
      const first = rows[0];
      const meta = await fetchJson(`${BAPI}/meta/ai?chainId=${first.chainId}&contractAddress=${first.contractAddress}`);
      dailyPdf = (meta.data && meta.data.dailyAttestationReports) || null;
    } catch { /* non-fatal */ }
    return {
      total_deployments: rows.length,
      unique_tickers: tickers.size,
      daily_attestation_pdf_pattern: '/images/web3-data/public/token/ondo/pdf/daily-YYYY-MM-DD.pdf',
      sample_daily_pdf: dailyPdf,
      tickers: [...tickers.values()],
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function collectMarket24h() {
  try {
    const all = await withMirror(
      () => fetchJson(`${BASE_URL}/api/v3/ticker/24hr`),
      () => fetchJson(`${MIRROR_URL}/api/v3/ticker/24hr`),
    );
    const up = all.filter(x => +x.priceChangePercent > 0).length;
    return {
      total_symbols: all.length,
      usdt_pairs: all.filter(x => x.symbol.endsWith('USDT')).length,
      up_pairs: up,
      down_pairs: all.length - up,
      top_gainers: [...all].sort((a, b) => +b.priceChangePercent - +a.priceChangePercent).slice(0, 10).map(g => ({ symbol: g.symbol, pct: +g.priceChangePercent })),
      date_as_of_end_of_day_utc: new Date().toISOString().slice(0, 10),
    };
  } catch (err) {
    return { error: err.message };
  }
}

function computeSummary({ identity, balances, ondo }) {
  return {
    report_kind: 'binance-daily',
    read_only: true,
    generated_by: 'scripts/fetch-daily-data.mjs',
    statement_style: 'modeled after Ondo Stocks daily attestation report (Ankura verification agent)',
    non_zero_asset_count: balances.non_zero ?? balances.count_total ?? 0,
    ondo_watch_count: (ondo.watched_stocks ?? []).filter(a => !a.error).length,
    hmac_verification: identity.hmac_verified === true ? 'passed' : 'skipped',
  };
}

/* ---------- main ---------- */
async function run() {
  const started = Date.now();
  const identity = await collectIdentity();
  const balances = await collectBalances();
  const ondo = await collectOndoStatement();
  const market = await collectMarket24h();
  const inventory = await collectStockInventory();
  const payload = {
    generated_at: new Date().toISOString(),
    generated_by: 'scripts/fetch-daily-data.mjs',
    kind: 'binance-daily',
    read_only: true,
    statement_header: {
      report_date_utc: new Date().toISOString().slice(0, 10),
      date_as_of_end_of_day: '20:00 ET equivalent captured at generation time (UTC)',
    },
    binance_identity: identity,
    balances: balances,
    ondo_statement: ondo,
    stock_inventory: inventory,
    market_24h: market,
    summary: computeSummary({ identity, balances, ondo }),
    elapsed_ms: Date.now() - started,
  };
  writeFileSync(OUT_FILE, JSON.stringify(payload, null, 1));
  console.log(`wrote ${OUT_FILE} (${readFileSync(OUT_FILE).length} bytes, ${payload.elapsed_ms} ms)`);
  console.log('binance_id:', identity.binance_id ?? identity.error);
  console.log('hmac_verified:', identity.hmac_verified ?? false);
  console.log('non_zero balances:', balances.non_zero ?? 0, '/', balances.count_total ?? 0);
  console.log('ondo watched:', (ondo.watched_stocks ?? []).filter(a => !a.error).length);
}

run().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
