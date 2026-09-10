#!/usr/bin/env node
import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';

const UNIVERSAL_TRANSFER_PATH = '/sapi/v1/account/universal-transfer';
const ACCOUNT_VALIDATE_PATH = '/api/v3/account';
const ETHEREUM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const UID_PATTERN = /^\d+$/;
const AMOUNT_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/;
const SCALE = 100000000n;
const MIN_AMOUNT_UNITS = 1000000n; // 0.01 * 1e8
const MAX_AMOUNT_UNITS = 200000000000000n; // 2,000,000 * 1e8

class SendUsdtError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function requireValue(value: string | undefined, name: string): string {
  const resolved = String(value ?? '').trim();
  if (!resolved) throw new SendUsdtError('missing_required_env', `${name} is required`);
  return resolved;
}

function parseAmountUnits(amount: string): { normalized: string; units: bigint } {
  const input = String(amount ?? '').trim();
  if (!AMOUNT_PATTERN.test(input)) {
    throw new SendUsdtError('invalid_amount_format', 'Amount must be a positive decimal string with up to 8 decimals');
  }

  const [intPart, fracPart = ''] = input.split('.');
  const padded = `${fracPart}00000000`.slice(0, 8);
  const units = BigInt(intPart) * SCALE + BigInt(padded || '0');

  if (units <= 0n) throw new SendUsdtError('invalid_amount', 'Amount must be greater than zero');
  if (units < MIN_AMOUNT_UNITS) throw new SendUsdtError('amount_too_small', 'Amount must be at least 0.01 USDT');
  if (units > MAX_AMOUNT_UNITS) throw new SendUsdtError('amount_too_large', 'Amount must not exceed 2000000 USDT');

  const whole = units / SCALE;
  const fraction = String(units % SCALE).padStart(8, '0').replace(/0+$/, '');
  const normalized = fraction ? `${whole.toString()}.${fraction}` : whole.toString();
  return { normalized, units };
}

function parseBool(value: string | undefined): boolean {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

function parseRecvWindow(value: string | undefined): string {
  const raw = String(value ?? '5000').trim();
  if (!/^\d+$/.test(raw)) throw new SendUsdtError('invalid_recv_window', 'BINANCE_RECV_WINDOW must be a positive integer');
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0 || num > 60000) {
    throw new SendUsdtError('invalid_recv_window', 'BINANCE_RECV_WINDOW must be between 1 and 60000 milliseconds');
  }
  return String(num);
}

function formatCommas(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatAmountForDisplay(amount: string): string {
  const [whole, fraction = ''] = amount.split('.');
  return fraction ? `${formatCommas(whole)}.${fraction}` : formatCommas(whole);
}

function buildQueryString(params: Record<string, string>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) searchParams.append(key, value);
  return searchParams.toString();
}

function loadEnvFileIfPresent(envPath: string, env = process.env): void {
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    if (!key || env[key] !== undefined) continue;

    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }
}

function loadDotEnvIfPresent(cwd = process.cwd(), env = process.env): void {
  loadEnvFileIfPresent(resolve(cwd, '.env.local'), env);
  loadEnvFileIfPresent(resolve(cwd, '.env'), env);
}

export function validateEthereumAddress(addr: string): boolean {
  return ETHEREUM_ADDRESS_PATTERN.test(String(addr ?? '').trim());
}

export function validateAmount(amount: string): boolean {
  try {
    parseAmountUnits(amount);
    return true;
  } catch {
    return false;
  }
}

export function validateNetworkChainId(network: string, chainId: string): boolean {
  return String(network ?? '').trim().toUpperCase() === 'ETH' && String(chainId ?? '').trim() === '1';
}

export function generateHmacSignature(queryString: string, secretKey: string): string {
  return createHmac('sha256', secretKey).update(queryString).digest('hex');
}

export function buildTransferParams({
  amount,
  timestamp,
  recvWindow,
}: {
  amount: string;
  timestamp: string;
  recvWindow: string;
}): Record<string, string> {
  return {
    fromSymbol: 'USDT',
    toSymbol: 'USDT',
    fromAccountType: 'SPOT',
    toAccountType: 'SPOT',
    amount,
    timestamp,
    recvWindow,
  };
}

function resolveConfig(env = process.env) {
  const apiKey = requireValue(env.BINANCE_API_KEY, 'BINANCE_API_KEY');
  const secretKey = requireValue(env.BINANCE_SECRET_KEY, 'BINANCE_SECRET_KEY');
  const uid = requireValue(env.BINANCE_UID, 'BINANCE_UID');
  if (!UID_PATTERN.test(uid)) throw new SendUsdtError('invalid_uid', 'BINANCE_UID must be a numeric string');

  const creatorAddress = requireValue(
    env.BINANCE_CREATOR_ADDRESS ?? env.BINANCE_ADDRESS_SENDER,
    'BINANCE_CREATOR_ADDRESS or BINANCE_ADDRESS_SENDER',
  );
  const contractAddress = requireValue(
    env.BINANCE_CONTRACT_ADDRESS ?? env.BINANCE_CONTRAC_ADDRESS,
    'BINANCE_CONTRACT_ADDRESS or BINANCE_CONTRAC_ADDRESS',
  );
  const walletReceive = requireValue(env.BINANCE_WALLET_RECEIVE, 'BINANCE_WALLET_RECEIVE');
  const ipApiList = String(env.BINANCE_IP_APILIST ?? '').trim();

  if (!validateEthereumAddress(creatorAddress)) throw new SendUsdtError('invalid_address', 'BINANCE_CREATOR_ADDRESS must be a valid Ethereum address');
  if (!validateEthereumAddress(contractAddress)) throw new SendUsdtError('invalid_address', 'BINANCE_CONTRACT_ADDRESS must be a valid Ethereum address');
  if (!validateEthereumAddress(walletReceive)) throw new SendUsdtError('invalid_address', 'BINANCE_WALLET_RECEIVE must be a valid Ethereum address');

  const network = String(env.BINANCE_NETWORK ?? 'ETH').trim().toUpperCase();
  const chainId = String(env.BINANCE_CHAIN_ID ?? '1').trim();
  if (!validateNetworkChainId(network, chainId)) {
    throw new SendUsdtError('invalid_network', 'Only Ethereum mainnet is supported (BINANCE_NETWORK=ETH and BINANCE_CHAIN_ID=1)');
  }

  const amountInput = String(env.BINANCE_WITHDRAW_AMOUNT ?? '1000000').trim();
  const { normalized: amount } = parseAmountUnits(amountInput);

  return {
    apiKey,
    secretKey,
    uid,
    creatorAddress,
    contractAddress,
    walletReceive,
    ipApiList,
    amount,
    network,
    chainId,
    baseUrl: String(env.BINANCE_BASE_URL ?? 'https://api.binance.com').trim().replace(/\/$/, ''),
    recvWindow: parseRecvWindow(env.BINANCE_RECV_WINDOW),
    allowLiveTransfer: parseBool(env.BINANCE_ALLOW_LIVE_TRANSFER),
  };
}

async function ensureApiCredentials(config: ReturnType<typeof resolveConfig>, fetchImpl = globalThis.fetch, now = Date.now): Promise<void> {
  const query = buildQueryString({
    timestamp: String(now()),
    recvWindow: config.recvWindow,
  });
  const signature = generateHmacSignature(query, config.secretKey);

  const url = `${config.baseUrl}${ACCOUNT_VALIDATE_PATH}?${query}`;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': config.apiKey,
        'X-MBX-SIGNATURE': signature,
      },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new SendUsdtError('network_error', 'Unable to validate Binance API credentials (network/timeout error)');
  }

  if (!response.ok) {
    throw new SendUsdtError('authentication_failure', `Binance API credential validation failed (HTTP ${response.status})`);
  }
}

async function promptConfirm(config: ReturnType<typeof resolveConfig>, promptTimeoutMs = 60_000): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const warning = [
    '⚠️  BINANCE INTERNAL TRANSFER CONFIRMATION',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `From UID:        ${config.uid}`,
    `Sender Addr:     ${config.creatorAddress}`,
    `To Wallet:       ${config.walletReceive}`,
    `Amount:          ${formatAmountForDisplay(config.amount)} USDT`,
    'Network:         Ethereum (ERC20, Chain ID 1)',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '⚠️  WARNING: This is a HIGH-VALUE transfer!',
    '📌 Recommend: Test with small amount first',
    '',
    "Type 'CONFIRM' to proceed: ",
  ].join('\n');

  try {
    const answer = await Promise.race([
      rl.question(warning),
      new Promise<string>((resolve) => setTimeout(() => resolve('__TIMEOUT__'), promptTimeoutMs)),
    ]);
    return answer === 'CONFIRM';
  } catch {
    return false;
  } finally {
    rl.close();
  }
}

async function sendTransfer(
  config: ReturnType<typeof resolveConfig>,
  params: Record<string, string>,
  signature: string,
  fetchImpl = globalThis.fetch,
): Promise<{ transactionId: string | null }> {
  const query = buildQueryString(params);
  const url = `${config.baseUrl}${UNIVERSAL_TRANSFER_PATH}?${query}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': config.apiKey,
        'X-MBX-SIGNATURE': signature,
      },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new SendUsdtError('network_error', 'Transfer request failed due to network/timeout error');
  }

  if (!response.ok) {
    throw new SendUsdtError('transfer_failed', `Binance internal transfer failed (HTTP ${response.status})`);
  }

  const json = await response.json().catch(() => ({}));
  const transactionId = json?.tranId ?? json?.txnId ?? json?.id ?? null;
  return { transactionId: transactionId === null ? null : String(transactionId) };
}

export async function runSendUsdt({
  argv = process.argv.slice(2),
  env = process.env,
  now = Date.now,
  fetchImpl = globalThis.fetch,
  confirmPrompt = promptConfirm,
  logger = console,
}: {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  now?: () => number;
  fetchImpl?: typeof globalThis.fetch;
  confirmPrompt?: (config: ReturnType<typeof resolveConfig>) => Promise<boolean>;
  logger?: Pick<typeof console, 'log' | 'error'>;
} = {}) {
  if (argv.includes('--help') || argv.includes('-h')) {
    logger.log(`Usage:\n  node src/scripts/send_usdt.ts [--send]\n\nDry-run is default. --send requires BINANCE_ALLOW_LIVE_TRANSFER=true and CONFIRM prompt.`);
    return { mode: 'help' };
  }

  loadDotEnvIfPresent(process.cwd(), env);

  const config = resolveConfig(env);
  await ensureApiCredentials(config, fetchImpl, now);

  const params = buildTransferParams({
    amount: config.amount,
    timestamp: String(now()),
    recvWindow: config.recvWindow,
  });

  const queryString = buildQueryString(params);
  const signature = generateHmacSignature(queryString, config.secretKey);

  const sendMode = argv.includes('--send');
  if (!sendMode) {
    const preview = {
      method: 'POST',
      endpoint: UNIVERSAL_TRANSFER_PATH,
      apiKey: '[redacted]',
      signature: '[redacted]',
      params: {
        ...params,
        timestamp: '[redacted]',
      },
      metadata: {
        uid: config.uid,
        creatorAddress: config.creatorAddress,
        contractAddress: config.contractAddress,
        walletReceive: config.walletReceive,
        ipApiList: config.ipApiList || '[not-set]',
        network: config.network,
        chainId: config.chainId,
      },
      note: 'Dry-run only. No blockchain transaction and no transfer mutation sent.',
    };
    logger.log('Dry-run mode enabled. No live transfer was sent.');
    logger.log(JSON.stringify(preview, null, 2));
    return { mode: 'dry-run', preview };
  }

  if (!config.allowLiveTransfer) {
    throw new SendUsdtError('live_transfer_not_allowed', 'BINANCE_ALLOW_LIVE_TRANSFER must be true when using --send');
  }

  const confirmed = await confirmPrompt(config);
  if (!confirmed) throw new SendUsdtError('transfer_cancelled', 'Live transfer cancelled');

  const result = await sendTransfer(config, params, signature, fetchImpl);

  logger.log('Request status: success');
  logger.log(`Transaction ID: ${result.transactionId ?? 'N/A'}`);

  return {
    mode: 'send',
    transactionId: result.transactionId,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSendUsdt().catch((error) => {
    const code = error instanceof SendUsdtError ? error.code : 'unknown_error';
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${code}: ${message}`);
    process.exit(1);
  });
}
