# Binance Skills Hub Secrets Reference / เอกสารอ้างอิง Secrets และ Variables

This file lists the environment variables, repository secrets, and repository
variables currently used by Binance Skills Hub code and workflows.

เอกสารนี้สรุป environment variables, repository secrets และ repository
variables ที่โค้ดและ workflows ของ Binance Skills Hub ใช้งานอยู่ในปัจจุบัน

## Secret naming note / หมายเหตุเรื่องชื่อ secret

- Use `BINANCE_SECRET_KEY`, not `BINANCE_API_SECRET`.
- ใช้ `BINANCE_SECRET_KEY` และไม่ใช้ `BINANCE_API_SECRET`

## Sensitive values / ค่าที่อ่อนไหว

| Runtime variable | GitHub storage name | Sensitive | Default/example | Used in |
| --- | --- | --- | --- | --- |
| `BINANCE_API_KEY` | `BINANCE_API_KEY` | Yes | none | `scripts/fetch-hourly-data.mjs`, `scripts/fetch-daily-data.mjs`, `.github/workflows/binance-1h-data.yml`, `.github/workflows/binance-daily-data.yml`, `.github/workflows/use-secrets.yml` |
| `BINANCE_SECRET_KEY` | `BINANCE_SECRET_KEY` | Yes | none | `scripts/fetch-hourly-data.mjs`, `scripts/fetch-daily-data.mjs`, `.github/workflows/binance-1h-data.yml`, `.github/workflows/binance-daily-data.yml`, `.github/workflows/use-secrets.yml`, `skills/binance-web3/usdt-erc20-transfer/scripts/binance_usdt_transfer.ts` |
| `BINANCE_UID` | `BINANCE_UID` | Yes | account UID | Documented repository variable name; `.github/workflows/AGENT_VARIABLES.yml` maps it to `BINANCE_ID` for compatibility |
| `BINANCE_IP_APILIST` | `BINANCE_IP_APILIST` | Yes if it exposes trusted infrastructure | `127.0.0.1/32,10.0.0.0/24` | Documented in `.env.example`, `.env.agent`, `SETUP_GUIDE.md`, and `.github/workflows/AGENT_VARIABLES.yml` as repository configuration metadata |
| `BINANCE_WALLET_RECEIVE` | `BINANCE_WALLET_RECEIVE` | Yes if it identifies a private receiving address | `0x...` | Documented repository variable name; `.github/workflows/AGENT_VARIABLES.yml` maps it to `ADDRESS_RECEIPT` for compatibility |
| `BINANCE_STOCK_MAP` | `BINANCE_ALHFA_GOOGLON` | Yes | JSON object | `scripts/fetch-daily-data.mjs` reads `BINANCE_STOCK_MAP`; `.github/workflows/binance-daily-data.yml` currently maps secret `BINANCE_ALHFA_GOOGLON` into that runtime name |
| `BINANCE_SQUARE_OPENAPI_KEY` | `BINANCE_SQUARE_OPENAPI_KEY` | Yes | none | `skills/binance/square-post/scripts/lib.mjs`, `skills/binance/square-post/scripts/save-key.mjs` |
| `PAYMENT_API_KEY` | `PAYMENT_API_KEY` | Yes | none | `skills/binance/payment/common.py` |
| `PAYMENT_API_SECRET` | `PAYMENT_API_SECRET` | Yes | none | `skills/binance/payment/common.py` |
| `ETH_RPC_URL` | `ETH_RPC_URL` | Yes if private provider; otherwise treat as sensitive by default | `https://ethereum-rpc.publicnode.com` | `skills/web3-tools/hardhat/scripts/hardhat.config.example.ts`, `skills/binance-web3/usdt-erc20-transfer/scripts/*.ts` |
| `PRIVATE_KEY` | `PRIVATE_KEY` | Yes | none | `skills/web3-tools/hardhat/scripts/hardhat.config.example.ts`, `skills/binance-web3/usdt-erc20-transfer/scripts/binance_usdt_transfer.ts`, `skills/binance-web3/usdt-erc20-transfer/scripts/ecdsa_sign_usdt.ts` |
| `ETHERSCAN_API_KEY` | `ETHERSCAN_API_KEY` | Yes | none | `skills/web3-tools/hardhat/scripts/hardhat.config.example.ts` |

## Non-sensitive defaults / ค่าทั่วไปที่ไม่อ่อนไหว

| Runtime variable | Recommended GitHub storage | Sensitive | Default/example | Used in |
| --- | --- | --- | --- | --- |
| `BINANCE_BASE_URL` | Repository variable `BINANCE_BASE_URL` | No | `https://api.binance.com` | `.github/workflows/binance-cli-test.yml` |
| `BASE_URL` | Repository variable `BASE_URL` | No | `https://api.binance.com` | `scripts/fetch-hourly-data.mjs`, `scripts/fetch-daily-data.mjs`, `.github/workflows/binance-1h-data.yml`, `.github/workflows/binance-daily-data.yml` |
| `MIRROR_URL` | Repository variable `MIRROR_URL` | No | `https://data-api.binance.vision` | `scripts/fetch-hourly-data.mjs`, `scripts/fetch-daily-data.mjs` |
| `PUBLIC_MIRROR_URL` | Repository variable `PUBLIC_MIRROR_URL` | No | `https://data-api.binance.vision` | `scripts/fetch-hourly-data.mjs`, `scripts/fetch-daily-data.mjs`, `.github/workflows/binance-1h-data.yml`, `.github/workflows/binance-daily-data.yml` |
| `DATA_DIR` | Repository variable `DATA_DIR` | No | `data` | `scripts/fetch-hourly-data.mjs`, `scripts/fetch-daily-data.mjs` |
| `DATA_FILE` | Repository variable `DATA_FILE` | No | `data/binance-1h.data` or `data/binance-daily.data` | `scripts/fetch-hourly-data.mjs`, `scripts/fetch-daily-data.mjs` |
| `BINANCE_SYMBOLS` | Repository variable `BINANCE_SYMBOLS` | No | `BTCUSDT,ETHUSDT,BNBUSDT,SOLUSDT` | `scripts/fetch-hourly-data.mjs`, `.github/workflows/binance-1h-data.yml` |
| `BINANCE_STOCKS` | Repository variable `BINANCE_STOCKS` | No | `GOOGL,AAPL,TSLA` | `scripts/fetch-daily-data.mjs`, `.github/workflows/binance-daily-data.yml` |
| `ETH_TOKENCONTRACT_USDT` | Repository variable `ETH_TOKENCONTRACT_USDT` | No | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | `skills/binance-web3/usdt-erc20-transfer/scripts/binance_usdt_transfer.ts`, `ecdsa_sign_usdt.ts`, `full_balance_check.ts` |
| `ETH_ADDRESS_SENDER` | Repository variable or secret, depending on privacy needs | No by default | `0x...` | `skills/binance-web3/usdt-erc20-transfer/scripts/binance_usdt_transfer.ts`, `ecdsa_sign_usdt.ts`, `full_balance_check.ts`, `skills/binance-web3/binance-hmac-skill/scripts/hmac_sign.ts` |
| `ADDRESS_RECEIPT` | Usually mapped from repository variable `BINANCE_WALLET_RECEIVE` | No by default | `0x...` | `skills/binance-web3/usdt-erc20-transfer/scripts/binance_usdt_transfer.ts`, `ecdsa_sign_usdt.ts`, `full_balance_check.ts` |
| `PAYMENT_BASE_URL` | Repository variable `PAYMENT_BASE_URL` | No | `https://bpay.binanceapi.com` | `skills/binance/payment/common.py` |

## Usage notes / หมายเหตุการใช้งาน

### Local `.env` / การใช้ `.env` แบบ local

- Copy `.env.example` to `.env`
- Fill real values only for the features you use
- Store `.env` locally and never commit it

- คัดลอก `.env.example` เป็น `.env`
- กรอกค่าจริงเฉพาะส่วนที่ใช้งาน
- เก็บ `.env` ไว้ local และห้าม commit

### Copilot Cloud Agent / การใช้กับ Copilot Cloud Agent

- Use `.env.agent` as the safe committed template
- Put live credentials in GitHub Secrets/Variables
- Map secrets into runtime env names inside workflows, not in source files

- ใช้ `.env.agent` เป็นเทมเพลตที่ commit ได้
- ใส่ credential จริงไว้ใน GitHub Secrets/Variables
- map secrets เข้าชื่อ runtime env ภายใน workflow ไม่ใช่ใน source code

## Quick examples / ตัวอย่างแบบย่อ

### Hourly market data / ข้อมูลตลาดรายชั่วโมง

`BINANCE_API_KEY`, `BINANCE_SECRET_KEY`, `BINANCE_SYMBOLS`, `DATA_FILE`

### Daily Ondo-style report / รายงานรายวันแบบ Ondo

`BINANCE_API_KEY`, `BINANCE_SECRET_KEY`, `BINANCE_UID`, `BINANCE_STOCKS`, `BINANCE_STOCK_MAP`

### Web3 transfer / โอน USDT บน Web3

`ETH_RPC_URL`, `PRIVATE_KEY`, `ETH_ADDRESS_SENDER`, `BINANCE_WALLET_RECEIVE`

### Payment / การชำระเงิน

`PAYMENT_API_KEY`, `PAYMENT_API_SECRET`, `PAYMENT_BASE_URL`

### Square / การโพสต์ Square

`BINANCE_SQUARE_OPENAPI_KEY`
