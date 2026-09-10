# Binance Skills Hub Setup Guide / คู่มือตั้งค่า Binance Skills Hub

This guide explains how to configure repository variables, secrets, and local
environment files for Binance Skills Hub.

คู่มือนี้อธิบายวิธีตั้งค่า repository variables, secrets และไฟล์ environment
แบบ local สำหรับ Binance Skills Hub

## 1. File map / ผังไฟล์

| File | Purpose (EN) | จุดประสงค์ (TH) |
| --- | --- | --- |
| `/home/runner/work/binance-skills-hub/binance-skills-hub/.env.example` | Full local environment template | เทมเพลตตัวแปรแบบ local ที่ครบถ้วน |
| `/home/runner/work/binance-skills-hub/binance-skills-hub/.env.agent` | Copilot Cloud Agent-oriented template | เทมเพลตสำหรับ Copilot Cloud Agent |
| `/home/runner/work/binance-skills-hub/binance-skills-hub/SECRETS_REFERENCE.md` | Detailed variable and secret inventory | เอกสารอ้างอิงตัวแปรและ secrets แบบละเอียด |
| `/home/runner/work/binance-skills-hub/binance-skills-hub/.github/workflows/AGENT_VARIABLES.yml` | Example GitHub Actions workflow | ตัวอย่าง workflow สำหรับ GitHub Actions |

## 2. Local environment setup / การตั้งค่า environment แบบ local

### Step 1: Create `.env` / สร้างไฟล์ `.env`

```bash
cd /home/runner/work/binance-skills-hub/binance-skills-hub
cp .env.example .env
chmod 600 .env
```

### Step 2: Fill only what you need / กรอกเฉพาะค่าที่ต้องใช้

| Use case | Required values |
| --- | --- |
| Hourly market data / ข้อมูลรายชั่วโมง | `BINANCE_API_KEY`, `BINANCE_SECRET_KEY`, `BINANCE_SYMBOLS` |
| Daily Ondo-style report / รายงานรายวัน | `BINANCE_API_KEY`, `BINANCE_SECRET_KEY`, `BINANCE_UID`, `BINANCE_STOCKS`, `BINANCE_STOCK_MAP` |
| Web3 / USDT tools / เครื่องมือ Web3 | `ETH_RPC_URL`, `PRIVATE_KEY`, `ETH_ADDRESS_SENDER`, `BINANCE_WALLET_RECEIVE` |
| Payment skill / สกิล Payment | `PAYMENT_API_KEY`, `PAYMENT_API_SECRET` |
| Square posting / โพสต์ Square | `BINANCE_SQUARE_OPENAPI_KEY` |

### Step 3: Keep `.env` private / เก็บ `.env` เป็นความลับ

- `.env` is already ignored by Git.
- `.env` ถูก ignore อยู่แล้วใน Git
- Keep real credentials only in `.env`, local config files, or GitHub Secrets.
- ให้เก็บ credential จริงไว้ใน `.env`, local config หรือ GitHub Secrets เท่านั้น

## 3. GitHub Secrets setup / การตั้งค่า GitHub Secrets

Open:

- Repository → **Settings** → **Secrets and variables** → **Actions**
- ไปที่ Repository → **Settings** → **Secrets and variables** → **Actions**

Requested repository variable names:

ค่าชื่อ repository variable ที่ร้องขอ:

| Variable name | Runtime meaning |
| --- | --- |
| `BINANCE_UID` | Binance account UID / ใช้เป็น UID ของบัญชี Binance |
| `BINANCE_API_KEY` | Binance API key / API key ของ Binance |
| `BINANCE_SECRET_KEY` | Binance secret key / secret key ของ Binance |
| `BINANCE_IP_APILIST` | Allowed API IP list / รายการ IP ที่อนุญาต |
| `BINANCE_WALLET_RECEIVE` | Receive wallet address stored in `.env.local` / ที่อยู่กระเป๋ารับที่เก็บใน `.env.local` |

Use repository variables for the first four names above. Keep
`BINANCE_WALLET_RECEIVE` in local `.env.local`.

ใช้ repository variables สำหรับ 4 ชื่อแรกด้านบน และให้เก็บ
`BINANCE_WALLET_RECEIVE` ไว้ใน `.env.local` แบบ local

Sensitive values should still be stored as GitHub Secrets when possible.

ค่าที่อ่อนไหวควรเก็บเป็น GitHub Secrets เมื่อทำได้

Create these **repository secrets** or secure equivalents:

| Secret | Why it is a secret (EN) | เหตุผลที่ควรเป็น secret (TH) |
| --- | --- | --- |
| `BINANCE_API_KEY` | Binance authenticated API access | ใช้ยืนยันตัวตนกับ Binance API |
| `BINANCE_SECRET_KEY` | Signs Binance requests | ใช้ลงลายเซ็นคำขอ Binance |
| `BINANCE_UID` | Account identifier for workflow parity/validation | ตัวระบุบัญชีสำหรับ workflow/validation |
| `BINANCE_IP_APILIST` | API IP allowlist metadata | ข้อมูลรายการ IP ที่อนุญาต |
| `BINANCE_ALHFA_GOOGLON` | Private stock-map payload mapped to `BINANCE_STOCK_MAP` | payload map ส่วนตัวที่ map ไปยัง `BINANCE_STOCK_MAP` |
| `BINANCE_SQUARE_OPENAPI_KEY` | Binance Square publishing access | ใช้เผยแพร่ไปยัง Binance Square |
| `PAYMENT_API_KEY` | Payment API authentication | ใช้ยืนยันตัวตน Payment API |
| `PAYMENT_API_SECRET` | Payment API signing | ใช้ลงลายเซ็น Payment API |
| `ETH_RPC_URL` | May expose private provider/project endpoint | อาจเป็น endpoint ส่วนตัวของผู้ให้บริการ RPC |
| `PRIVATE_KEY` | Wallet signing key | private key สำหรับลงนามธุรกรรม |
| `ETHERSCAN_API_KEY` | Etherscan/verification access | ใช้สำหรับ verify กับ Etherscan |

## 4. GitHub Variables setup / การตั้งค่า GitHub Variables

Create these **repository variables** when you want reusable non-sensitive
defaults:

| Variable | Suggested default | Default ที่แนะนำ |
| --- | --- | --- |
| `BINANCE_BASE_URL` | `https://api.binance.com` | `https://api.binance.com` |
| `BASE_URL` | `https://api.binance.com` | `https://api.binance.com` |
| `MIRROR_URL` | `https://data-api.binance.vision` | `https://data-api.binance.vision` |
| `PUBLIC_MIRROR_URL` | `https://data-api.binance.vision` | `https://data-api.binance.vision` |
| `DATA_DIR` | `data` | `data` |
| `DATA_FILE` | `data/binance-1h.data` or `data/binance-daily.data` | `data/binance-1h.data` หรือ `data/binance-daily.data` |
| `BINANCE_SYMBOLS` | `BTCUSDT,ETHUSDT,BNBUSDT,SOLUSDT` | `BTCUSDT,ETHUSDT,BNBUSDT,SOLUSDT` |
| `BINANCE_STOCKS` | `GOOGL,AAPL,TSLA` | `GOOGL,AAPL,TSLA` |
| `ETH_TOKENCONTRACT_USDT` | `0xYOUR_USDT_CONTRACT_ADDRESS` | `0xYOUR_USDT_CONTRACT_ADDRESS` |
| `ETH_ADDRESS_SENDER` | sender wallet address | ที่อยู่กระเป๋าผู้ส่ง |
| `ADDRESS_RECEIPT` | recipient wallet address | ที่อยู่กระเป๋าผู้รับ |
| `PAYMENT_BASE_URL` | `https://bpay.binanceapi.com` | `https://bpay.binanceapi.com` |

## 5. Copilot Cloud Agent configuration / การตั้งค่า Copilot Cloud Agent

1. Use `.env.agent` as the committed template.
2. Store real values in GitHub Secrets/Variables, not in `.env.agent`.
3. Map GitHub Secrets/Variables into runtime env names inside workflows.
4. Review `/home/runner/work/binance-skills-hub/binance-skills-hub/.github/workflows/AGENT_VARIABLES.yml`
   for a safe example.

1. ใช้ `.env.agent` เป็นเทมเพลตที่ commit ได้
2. ใส่ค่าจริงใน GitHub Secrets/Variables ไม่ใช่ใน `.env.agent`
3. map ค่าเหล่านั้นเป็น runtime env ภายใน workflow
4. ดูตัวอย่างที่ `.github/workflows/AGENT_VARIABLES.yml`

Local-only wallet setting:

ค่ากระเป๋ารับแบบ local เท่านั้น:

```bash
cat > /home/runner/work/binance-skills-hub/binance-skills-hub/.env.local <<'EOF'
BINANCE_WALLET_RECEIVE=0x0000000000000000000000000000000000000000
ADDRESS_RECEIPT=0x0000000000000000000000000000000000000000
EOF
chmod 600 /home/runner/work/binance-skills-hub/binance-skills-hub/.env.local
```

Current example mappings:

ตัวอย่าง mapping ปัจจุบัน:

- `BINANCE_UID` → `BINANCE_ID`
- `.env.local` `BINANCE_WALLET_RECEIVE` → local runtime `ADDRESS_RECEIPT`

## 6. Example use cases / ตัวอย่างการใช้งาน

### Read-only data collection / การดึงข้อมูลแบบอ่านอย่างเดียว

```bash
source .env
node scripts/fetch-hourly-data.mjs
```

### Daily data generation / การสร้างข้อมูลรายวัน

```bash
source .env
DATA_FILE=data/binance-daily.data node scripts/fetch-daily-data.mjs
```

### Square posting / การโพสต์ Square

```bash
BINANCE_SQUARE_OPENAPI_KEY=your_key node skills/binance/square-post/scripts/save-key.mjs
```

## 7. Security best practices / แนวปฏิบัติด้านความปลอดภัย

- Never commit real secrets or wallet private keys.
- ห้าม commit secret จริงหรือ private key จริง
- Prefer repository secrets for anything that authenticates, signs, pays, or
  identifies a private account.
- ให้ใช้ repository secrets สำหรับค่าที่เกี่ยวกับการยืนยันตัวตน การลงนาม
  การชำระเงิน หรือการระบุตัวบัญชีส่วนตัว
- Treat wallet addresses and `BINANCE_UID` as sensitive operational metadata if
  they identify real accounts you do not want to expose.
- หาก wallet address หรือ `BINANCE_UID` ชี้ไปยังบัญชีจริงที่ไม่ต้องการเปิดเผย
  ให้ถือว่าเป็นข้อมูลอ่อนไหวเชิงปฏิบัติการ
- Do not print full secrets in workflow logs.
- ห้ามพิมพ์ค่า secret แบบเต็มลงใน workflow logs
- Do not reintroduce deprecated `BINANCE_API_SECRET`.
- ห้ามนำ `BINANCE_API_SECRET` ที่เลิกใช้แล้วกลับมาใช้อีก

## 8. File organization / โครงสร้างการจัดเก็บไฟล์

- Keep tracked templates in the repository root: `.env.example`, `.env.agent`,
  `SETUP_GUIDE.md`, `SECRETS_REFERENCE.md`
- Keep live credentials outside versioned files: `.env`, GitHub Secrets, local
  config such as payment `config.json`, or the Square saved key file
- Keep `BINANCE_WALLET_RECEIVE` in `.env.local` because it is local-only wallet
  routing data for the current setup
- เก็บเทมเพลตที่ track ได้ไว้ที่ root ของ repository
- เก็บ credential จริงไว้นอกไฟล์ที่ version control เช่น `.env`, GitHub
  Secrets, `config.json` ของ payment หรือไฟล์ key ที่ Square บันทึกไว้
- ให้เก็บ `BINANCE_WALLET_RECEIVE` ไว้ใน `.env.local` เพราะเป็นข้อมูลเส้นทาง
  กระเป๋าแบบ local-only สำหรับ setup ปัจจุบัน
