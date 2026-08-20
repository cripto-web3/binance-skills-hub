#!/usr/bin/env python3
"""Binance connection check: API key + secret key + HMAC + Binance ID (read-only).

Reads credentials from /home/ubuntu/binance-skills-hub/.env (local only).
All calls are read-only / public endpoints. No trade/withdrawal endpoints touched.
"""
import time, hmac, hashlib, json
import requests

ENV_PATH = '/home/ubuntu/binance-skills-hub/.env'
env = {}
for line in open(ENV_PATH):
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    k, v = line.split('=', 1)
    v = v.strip()
    # shell-style quoting: strip one layer of single/double quotes
    if len(v) >= 2 and v[0] in ('"', "'") and v[-1] == v[0]:
        v = v[1:-1]
    env[k.strip()] = v

key = env.get('BINANCE_API_KEY') or env.get('binance_api_key')
secret = env.get('BINANCE_API_SECRET') or env.get('binane_secret_key') or env.get('BINANCE_SECRET_KEY')
binance_id = env.get('BINANCE_ID') or env.get('binance_id')
stock_map = env.get('BINANCE_STOCK_MAP')
assert key and secret, 'missing key/secret in .env'

H = {'X-MBX-APIKEY': key}
BASE = 'https://api.binance.com'

def signed(method, endpoint, params):
    """Build HMAC-SHA256 signature exactly like binance-cli does."""
    params['timestamp'] = int(time.time() * 1000)
    qs = '&'.join(f'{k}={params[k]}' for k in params)
    sig = hmac.new(secret.encode(), qs.encode(), hashlib.sha256).hexdigest()
    url = f'{BASE}{endpoint}?{qs}&signature={sig}'
    return requests.request(method, url, headers=H, timeout=15)

ok, fail = [], []

# 1. Public endpoints
r = requests.get(f'{BASE}/api/v3/time', timeout=15)
(fail if r.status_code != 200 else ok).append(f'api/v3/time HTTP {r.status_code}')

r = requests.get(f'{BASE}/api/v3/ping', timeout=15)
(fail if r.status_code != 200 else ok).append(f'api/v3/ping HTTP {r.status_code}')

r = requests.get(f'{BASE}/api/v3/ticker/price?symbol=BTCUSDT', timeout=15)
(fail if r.status_code != 200 else ok).append(f'BTCUSDT ticker HTTP {r.status_code}')

# 2. Signed read-only endpoints (HMAC math)
r = signed('GET', '/sapi/v1/asset/assetDetail', {'asset': 'USDT'})
(fail if r.status_code != 200 else ok).append(f'assetDetail USDT (signed) HTTP {r.status_code}')

r = signed('GET', '/sapi/v1/account/apiRestrictions', {})
(fail if r.status_code != 200 else ok).append(f'apiRestrictions (signed) HTTP {r.status_code} {r.text[:120] if r.status_code!=200 else "200"}')

# 3. Account snapshot (read-only, proves key identity)
now = int(time.time() * 1000)
r = signed('GET', '/sapi/v1/accountSnapshot', {'type': 'SPOT', 'limit': 1, 'startTime': now - 86400000, 'endTime': now})
if r.status_code == 200:
    d = r.json()
    vos = d.get('snapshotVos') or []
    if vos and vos[0].get('data', {}).get('balances'):
        bal = [b for b in vos[0]['data']['balances'] if float(b['free']) + float(b['locked']) > 0]
        ok.append(f'accountSnapshot SPOT HTTP 200 (assets with balance: {len(bal)})')
    else:
        ok.append(f'accountSnapshot SPOT HTTP 200 (no snapshot data — account may be empty)')
else:
    (fail if r.status_code != 200 else ok).append(f'accountSnapshot HTTP {r.status_code} {r.text[:120]}')

# 4. Binance ID (user UID) identity check — use GET /api/v3/account (SPOT) as source of truth
r = signed('GET', '/api/v3/account', {})
if r.status_code == 200:
    d = r.json()
    uid = d.get('uid')
    nonzero = [b for b in d.get('balances', []) if float(b['free']) + float(b['locked']) > 0]
    print(f"  account UID: {uid}, accountType={d.get('accountType')}, canTrade={d.get('canTrade')}, canWithdraw={d.get('canWithdraw')}, assets>0: {len(nonzero)}")
    if binance_id and str(uid) == str(binance_id):
        ok.append(f"Binance ID match: uid {uid} == .env binance_id {binance_id}")
    elif binance_id:
        fail.append(f"Binance ID MISMATCH: API key uid {uid} != .env binance_id {binance_id}")
    else:
        ok.append(f"Binance ID from API key: uid {uid}")
    ok.append(f"Spot balances loaded: {len(d.get('balances', []))} symbols (non-zero: {len(nonzero)})")
else:
    (fail if r.status_code != 200 else ok).append(f'UID check (/api/v3/account) HTTP {r.status_code} {r.text[:100]}')

# 5. HMAC tamper test (wrong secret must be rejected)
ts = int(time.time() * 1000)
qs = f'asset=USDT&timestamp={ts}'
sig_bad = hmac.new(b'__WRONG_SECRET__', qs.encode(), hashlib.sha256).hexdigest()
r = requests.get(f'{BASE}/sapi/v1/asset/assetDetail?{qs}&signature={sig_bad}', headers=H, timeout=15)
if r.status_code == 400 and '-1022' in r.text:
    ok.append(f'HMAC tamper detection OK (wrong secret -> 400 -1022)')
else:
    fail.append(f'HMAC tamper FAIL: got {r.status_code} {r.text[:80]}')

# 6. Read-only enforcement: ensure spot trading restriction on
r = signed('GET', '/sapi/v1/account/apiRestrictions', {})
if r.status_code == 200:
    d = r.json()
    print(f"  IP restrictions: {json.dumps(d.get('ipRestrict'))}  enableSpot: {d.get('enableSpot')}  enableWithdrawals: {d.get('enableWithdrawals')}")
    if not d.get('enableSpot'):
        ok.append('Read-only enforced: enableSpot=false (spot trading disabled on this API key)')
    else:
        fail.append('WARNING: enableSpot=true — key can TRADE. Rotate key or disable trading permission!')
    if d.get('enableWithdrawals'):
        fail.append('WARNING: enableWithdrawals=true — key can WITHDRAW. Disable immediately!')
    else:
        ok.append('Read-only enforced: enableWithdrawals=false')

# 7. Stock token map (BINANCE_STOCK_MAP) presence
if stock_map:
    try:
        d = json.loads(stock_map)
        ok.append(f'BINANCE_STOCK_MAP valid JSON ({len(d)} entries) — contractAddress loaded from env, never in output files')
    except Exception as e:
        fail.append(f'BINANCE_STOCK_MAP invalid: {e}')
else:
    fail.append('BINANCE_STOCK_MAP missing in .env')

print('\n=== Binance connection check (read-only) ===')
print(f"key={key[:8]}...({len(key)}c)  secret={len(secret)}c  binance_id={binance_id}")
print('\nPASS:')
for x in ok: print('  +', x)
print('\nFAIL:')
for x in fail: print('  -', x)
print(f"\nRESULT: {len(ok)} pass, {len(fail)} fail")
raise SystemExit(1 if fail else 0)
