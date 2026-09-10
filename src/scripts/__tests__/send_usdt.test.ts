import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTransferParams,
  generateHmacSignature,
  runSendUsdt,
  validateAmount,
  validateEthereumAddress,
  validateNetworkChainId,
} from '../send_usdt.ts';

test('validateEthereumAddress validates strict ethereum address format', () => {
  assert.equal(validateEthereumAddress('0x1234567890abcdef1234567890abcdef12345678'), true);
  assert.equal(validateEthereumAddress('0x1234'), false);
  assert.equal(validateEthereumAddress('0xZZ34567890abcdef1234567890abcdef12345678'), false);
});

test('validateAmount enforces precision and min/max limits', () => {
  assert.equal(validateAmount('1000000'), true);
  assert.equal(validateAmount('0.01000000'), true);
  assert.equal(validateAmount('0.00999999'), false);
  assert.equal(validateAmount('2000000.00000000'), true);
  assert.equal(validateAmount('2000000.00000001'), false);
  assert.equal(validateAmount('1.123456789'), false);
});

test('validateNetworkChainId allows ETH mainnet only', () => {
  assert.equal(validateNetworkChainId('ETH', '1'), true);
  assert.equal(validateNetworkChainId('eth', '1'), true);
  assert.equal(validateNetworkChainId('BSC', '56'), false);
});

test('generateHmacSignature creates expected SHA256 signature', () => {
  const signature = generateHmacSignature('foo=bar&baz=qux', 'secret');
  assert.equal(signature, '7dcb5c22610e784e0b117bb0a739090e8b517914635cb83f1502284ca10c299e');
});

test('buildTransferParams keeps Binance insertion order', () => {
  const params = buildTransferParams({ amount: '1000000', timestamp: '123', recvWindow: '5000' });
  assert.deepEqual(Object.keys(params), [
    'fromSymbol',
    'toSymbol',
    'fromAccountType',
    'toAccountType',
    'amount',
    'timestamp',
    'recvWindow',
  ]);
});

test('runSendUsdt dry-run validates credentials and never calls transfer endpoint', async () => {
  const calls: Array<{ url: string; method: string | undefined }> = [];
  const logs: string[] = [];

  const fetchImpl: typeof globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method });

    if (url.startsWith('https://api.binance.com/api/v3/account?')) {
      return new Response('{}', { status: 200 });
    }

    throw new Error(`Unexpected URL: ${url}`);
  };

  const env = {
    BINANCE_API_KEY: 'testapikey12345678',
    BINANCE_SECRET_KEY: 'testsecret',
    BINANCE_UID: '123456',
    BINANCE_CREATOR_ADDRESS: '0x1234567890abcdef1234567890abcdef12345678',
    BINANCE_CONTRACT_ADDRESS: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    BINANCE_WALLET_RECEIVE: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    BINANCE_WITHDRAW_AMOUNT: '1000000.00000000',
    BINANCE_NETWORK: 'ETH',
    BINANCE_CHAIN_ID: '1',
    BINANCE_BASE_URL: 'https://api.binance.com',
    BINANCE_RECV_WINDOW: '5000',
  };

  const result = await runSendUsdt({
    argv: [],
    env,
    now: () => 1700000000000,
    fetchImpl,
    logger: {
      log: (line: string) => logs.push(line),
      error: () => {},
    },
  });

  assert.equal(result.mode, 'dry-run');
  assert.equal(calls.some((c) => c.url.includes('/sapi/v1/account/universal-transfer')), false);
  assert.equal(logs.join('\n').includes('testsecret'), false);
});

test('runSendUsdt send mode requires confirmation and sends transfer when allowed', async () => {
  const calls: Array<{ url: string; method: string | undefined }> = [];

  const fetchImpl: typeof globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method });

    if (url.startsWith('https://api.binance.com/api/v3/account?')) {
      return new Response('{}', { status: 200 });
    }

    if (url.startsWith('https://api.binance.com/sapi/v1/account/universal-transfer?')) {
      return new Response(JSON.stringify({ tranId: 987654321 }), { status: 200 });
    }

    throw new Error(`Unexpected URL: ${url}`);
  };

  const env = {
    BINANCE_API_KEY: 'testapikey12345678',
    BINANCE_SECRET_KEY: 'testsecret',
    BINANCE_UID: '123456',
    BINANCE_CREATOR_ADDRESS: '0x1234567890abcdef1234567890abcdef12345678',
    BINANCE_CONTRACT_ADDRESS: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    BINANCE_WALLET_RECEIVE: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    BINANCE_WITHDRAW_AMOUNT: '1000000',
    BINANCE_NETWORK: 'ETH',
    BINANCE_CHAIN_ID: '1',
    BINANCE_BASE_URL: 'https://api.binance.com',
    BINANCE_ALLOW_LIVE_TRANSFER: 'true',
  };

  const result = await runSendUsdt({
    argv: ['--send'],
    env,
    now: () => 1700000000000,
    fetchImpl,
    confirmPrompt: async () => true,
    logger: { log: () => {}, error: () => {} },
  });

  assert.equal(result.mode, 'send');
  assert.equal(result.transactionId, '987654321');
  assert.equal(calls.filter((c) => c.url.includes('/sapi/v1/account/universal-transfer')).length, 1);
  assert.equal(calls.find((c) => c.url.includes('/sapi/v1/account/universal-transfer'))?.method, 'POST');
});
