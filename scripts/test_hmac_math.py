#!/usr/bin/env python3
"""Verify HMAC-SHA256 math against live Binance signed (read-only) endpoints using repo .env."""
import time, hmac, hashlib
import requests

env = {}
for line in open('/home/ubuntu/binance-skills-hub/.env'):
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    k, v = line.split('=', 1)
    env[k.strip()] = v.strip()

key = env['BINANCE_API_KEY']
secret = env['BINANCE_API_SECRET']
assert len(key) >= 64 and len(secret) >= 64, (len(key), len(secret))

def signed(params, endpoint):
    params['timestamp'] = int(time.time() * 1000)
    qs = '&'.join(f'{k}={params[v] if isinstance(v, str) and v in params else params.get(k)}' for k in params)
    sig = hmac.new(secret.encode(), qs.encode(), hashlib.sha256).hexdigest()
    url = f'https://api.binance.com{endpoint}?{qs}&signature={sig}'
    return requests.get(url, headers={'X-MBX-APIKEY': key}, timeout=10)

r1 = requests.get('https://api.binance.com/api/v3/time', timeout=10)
print('api/v3/time :', r1.status_code, r1.json().get('serverTime'))

r2 = signed({}, '/sapi/v1/accountStatus')
print('accountStatus (read-only):', r2.status_code, r2.text[:150])

r3 = signed({'asset': 'USDT'}, '/sapi/v1/asset/assetDetail')
print('assetDetail USDT:', r3.status_code, r3.text[:200] if r3.ok else r3.text[:150])
