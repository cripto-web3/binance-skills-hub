# คู่มือระบบ Binance 1H Data Update (Read-Only)

ระบบนี้อัปเดตข้อมูลตลาด Binance อัตโนมัติทุก 1 ชั่วโมงผ่าน GitHub Actions
โดยบันทึกผลลัพธ์ลงไฟล์ `data/binance-1h.data` ใน repository

## หลักการสำคัญ: Read-Only เท่านั้น

ระบบนี้**ไม่มีวัน**วางออร์เดอร์ โอนเงิน หรือถอนเงินใด ๆ ทั้งสิ้น
ทุก endpoint ที่ใช้เป็นแบบอ่านข้อมูล (market data, account snapshot)
แม้จะมี API Key/Secret ก็ตาม

## ข้อมูลที่เก็บในแต่ละรอบ (1H)

| หมวด | ข้อมูล | แหล่ง |
|------|--------|-------|
| `spot_tickers` | ราคา 24 ชม., %การเปลี่ยนแปลง, high/low, volume ของโทเคนที่ติดตาม | `/api/v3/ticker/24hr` |
| `market_summary` | จำนวนคู่เทรด, สัดส่วนคู่ขึ้น/ลง, Top 10 gainers/losers | `/api/v3/ticker/24hr` |
| `funding` | อัตรา funding ของ BTCUSDT futures พร้อมประวัติ 5 ล่าสุด | `/fapi/v1/fundingRate` |
| `margin` | จำนวน asset ที่กู้ยืมได้ (borrowable) ใน margin | `/sapi/v1/margin/allAssets` |
| `stock` | หุ้นที่มีโทเคนบน Binance (tokenized stocks) | `/api/v3/exchangeInfo` |
| `bnb_alpha` | ราคา BNB, momentum 24 ชม., เทียบค่าเฉลี่ย 24 ชม., จำนวน BNB pairs | `/api/v3/klines`, `/api/v3/exchangeInfo` |
| `smart_money_opinion` | มุมมองตลาดอัตโนมัติ: momentum + funding + breadth → bullish/neutral/bearish | สังเคราะห์จากข้อมูลข้างต้น |
| `account` | uid, permissions, ยอดคงเหลือ (เฉพาะที่ไม่เป็นศูนย์) — **HMAC signed** | `/api/v3/account` |

## โครงสร้างไฟล์ `data/binance-1h.data`

```json
{
  "generated_at": "2026-08-20T13:05:00.000Z",
  "generated_by": "scripts/fetch-hourly-data.mjs",
  "kind": "binance-1h",
  "read_only": true,
  "spot_tickers": { "BTCUSDT": { "last_price": ..., "change_pct": ..., ... }, ... },
  "market_summary": { "total_symbols": 3684, "up_pairs": 465, ... },
  "funding": { "symbol": "BTCUSDT", "last_rate": "0.0001", ... },
  "margin": { "borrowable_count": 395, ... },
  "stock": { "count": 280, ... },
  "bnb_alpha": { "bnb_price": 642.99, "momentum_24h_pct": 6.4, ... },
  "account": { "uid": 115213344, "non_zero_balances": [...] },
  "smart_money_opinion": { "signals": [...], "opinion": "bullish", "composite_score": 2 },
  "elapsed_ms": 15632
}
```

## การตั้งค่า GitHub Secrets (ทำครั้งเดียว)

1. เปิด [Settings → Secrets and variables → Actions](https://github.com/cripto-web3/binance-skills-hub/settings/secrets/actions) ของ repo `binance-skills-hub`
2. กด **New repository secret** 2 ตัว:

| Secret Name | ค่า |
|-------------|-----|
| `BINANCE_API_KEY` | API Key ของคุณ (เช่น `1jA35qAXOaTCLGDhAXE06uT4...`) |
| `BINANCE_API_SECRET` | Secret Key ของคุณ (เช่น `Wvt8eyEqsdBA8Fq9udef95kNqk...`) |

3. ค่า API Key/Secret จะถูกใช้เฉพาะใน GitHub Actions runtime — **ไม่ถูก commit** ลง repo

> หากลืมใส่ secrets: workflow จะยังรันได้แต่หมวด `account` จะถูกข้าม
> (ข้อมูลตลาด public ทั้งหมดจะยังมาครบ)

## สัญญาณ Smart Money Opinion

| สัญญาณ | เกณฑ์ |
|--------|--------|
| strong bullish momentum | โทเคนที่ติดตามเปลี่ยนแปลงเฉลี่ย > +2% ใน 24 ชม. (+2 แต้ม) |
| mild bullish | เฉลี่ยบวกแต่ < +2% (+1) |
| strong bearish | เฉลี่ย < -2% (-2) |
| longs crowded | funding > 0.05% (-1, เตือนว่าฝั่ง long แน่น) |
| shorts crowded | funding < -0.05% (+1) |
| broad breadth | คู่ USDT ขึ้น > 70% (+1) / ลง > 70% (-1) |

สรุป: คะแนนรวม ≥ 2 → **bullish**, ≤ -2 → **bearish**, ระหว่างนั้น → **neutral**

## การควบคุม

- **ดูผลลัพธ์ล่าสุด**: เปิดไฟล์ `data/binance-1h.data` ใน repo
- **รันทันที (ไม่รอชั่วโมง)**: Actions → "Binance 1H Data Update" → **Run workflow**
- **แก้โทเคนที่ติดตาม**: ปรับ env `BINANCE_SYMBOLS` ใน workflow (ค่าเริ่มต้น: BTCUSDT,ETHUSDT,BNBUSDT,SOLUSDT)
- **ปรับเวลา**: ปรับ cron ใน workflow (เริ่มต้น: นาทีที่ 5 ของทุกชั่วโมง)

## ความปลอดภัย

- `.env` / `scripts/write-env.sh` มีค่าจริง → gitignore บังคับ ไม่เคย commit
- `.env.example` มีค่าปลอม → ปลอดภัยต่อการเผยแพร่
- Geo-restricted runner (เช่น US) จะ fallback ใช้ mirror `data-api.binance.vision`
- Futures funding อาจถูกบล็อกในบางภูมิภาค → หมวด `funding` จะแสดง error message แทน (ไม่ fail ทั้ง workflow)
