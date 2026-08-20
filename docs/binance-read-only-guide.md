# Binance API — คู่มือแบบ Read-Only (ภาษาไทย)

เอกสารนี้อธิบายการใช้งาน Binance API แบบ **อ่านข้อมูลอย่างเดียว** (Read-Only) ด้วยคู่ API Key ของบัญชี `binance_id=115213344` — ครอบคลุมสิ่งที่ทำได้ ข้อจำกัด และ Rate Limit

---

## 1. หลักการความปลอดภัย

การใช้งานแบบ Read-Only แยกเป็นสองระดับที่ควรเข้าใจ:

| ระดับ | ความหมาย |
| --- | --- |
| **ระดับการตั้งค่าบน Binance (server)** | ไปที่ Binance → API Management → API Key → เลือก "Enable Reading" เท่านั้น — ถอด "Enable Spot & Margin Trading", "Enable Futures", "Enable Withdrawals" ออก |
| **ระดับการใช้งาน (client)** | โปรแกรมส่งคำขอประเภท GET (อ่าน) เท่านั้น — ไม่เรียก endpoint สั่งซื้/ขาย/ถอนเงิน |

> คำแนะนำ: ใช้ทั้งสองระดับพร้อมกัน — ถ้าคียังมีสิทธิ trade อยู่แม้โปรแกรมจะส่งเฉพาะ GET ก็ยังเสี่ยงหากคีวเล็ดลอด ให้ revoke คุณสมบัติการเทรดบนเซิร์ฟเวอร์จริง

---

## 2. สิ่งที่ทำได้ด้วย API แบบ Read-Only

### 2.1 Public Endpoints (ไม่ต้องใช้คุณสิทธิของคีเลย)

ใช้กับทุกคน ไม่จำเป็นต้องมี API Key:

| Endpoint | คำสั่งใน binance-cli | ข้อมูลที่ได้ |
| --- | --- | --- |
| ราคาปัจจุบัน | `binance-cli spot ticker --symbol BTCUSDT` | ราคา BTC/USDT ล่าสุด |
| ราคาทุกคู่เทรด | `binance-cli spot ticker` | ราคาทุกสัญญาลักษณ์ในครั้งเดียว |
| รายละเอียดตลาด | `binance-cli spot exchange-info` | คู่เทรด 1,361+ รายการ, lot size, tick size |
| ราคาบัญชี | `binance-cli spot server-time` | เวลาเซิร์ฟเวอร์ (เช็ก clock skew) |
| Health check | `binance-cli spot ping` | ตอบ `{}` = เซิร์ฟเวอร์ทำงานปกติ |
| Depth / OHLCV | `binance-cli spot depth --symbol BTCUSDT`, `binance-cli spot klines --symbol BTCUSDT --interval 1d` | Order book, กราฟแท่งเทียน |

### 2.2 Private Endpoints (ต้องใช้คีที่มีลายเซ็น HMAC-SHA256)

ต้องมี API Key + Secret Key ที่มีสิทธิ "Enable Reading":

| Endpoint | ข้อมูลที่ได้ |
| --- | --- |
| `GET /api/v3/account` | ยอดคงเหลือทุกเหรียญ, สิทธิ trade/withdraw/deposit, permissions ของคี |
| `GET /api/v3/myTrades` | ประวัติการเทรดย้อนหลังของบัญชี |
| `GET /api/v3/openOrders` | ออร์เดอร์ที่เปิดอยู่ (0 ถ้าไม่มี) |
| `GET /api/v3/allOrders` | ทุกออร์เดอร์ที่เคยส่ง |
| `GET /api/v3/order` | สถานะออร์เดอร์เฉพาะรายการ |
| `GET /sapi/v1/*` (บางรายการ) | ข้อมูล spot margin / staking อ่านได้ถ้าสิทธิเปิด |

สคริปต์ทดสอบสำเร็จแล้วใน sandbox: `scripts/test-key-read-only.py` — ตรวจ uid=115213344 ตรงกับบัญชี และอ่านยอดคงเหลือได้จริง

---

## 3. ข้อจำกัด (Rate Limits)

Binance บังคับข้อจำกัดตามน้ำหนัก (weight) ต่อช่วงเวลา:

| ประเภท | ขีดจำกัด | หมายเหตุ |
| --- | --- | --- |
| IP — public endpoints | 6,000 weight / นาที / IP | endpoint น้ำหนักมาก เช่น exchange-info = 20 weight |
| IP — หนักเกิน | ถูกแบน IP ชั่วคราว ~2-5 นาที (HTTP 418) | หลีกเลี่ยงการ poll ถี่เกินไป |
| คี — private endpoints | 10,000 weight / นาที / คี | เช่น account = 20 weight |
| สั่งช้า | 10 คำสั่ ง / วินาที / คี (อัตราการส่งใหม่) | ถ้าพิด trade จะไม่กระทบ |

**แนวทางปฏิบัติ**: poll ราคา 1-5 วินาทีต่อคู่คุณสมบัติปลอดภัย; อ่าน account ต่อเนื่องควรทุก 1-5 นาที

---

## 4. สิ่งที่ทำ**ไม่ได้** ด้วย Read-Only

| สิ่งที่ทำไม่ได้ | หมายเหตุ |
| --- | --- |
| สั่งซื้/ขาย (POST /order) | API จะคืน 401 Unauthorized ถ้าคียังไม่ถูกถอดสิทธิ trade |
| ยกเลิกออร์เดอร์ | ต้องมีสิทธิ trade |
| ถอน/ฝากเงิน | ต้องมีสิทธิ withdraw/deposit — เสี่ยงสูงสุดถ้าคีรั่วไหล |
| สร้างคีใหม่/ถอนคีผ่าน API | ไม่ใช่หน้าที่ของคีย่อย |

---

## 5. วิธีเริ่มใช้งานใน sandbox นี้

```bash
cd /home/ubuntu/binance-skills-hub

# 1. โหลดคี่จาก .env (คีจริงอยู่ในไฟล์นี้เท่านั้น — gitignore บังคับไม่ให้ push)
source .env
export BINANCE_API_KEY BINANCE_API_SECRET

# 2. ทดสอบแบบ public (ไม่ต้องใช้คี)
binance-cli spot ticker --symbol BTCUSDT

# 3. ทดสอบแบบ private (อ่านยอดคงเหลือ + สิทธิ)
python3 scripts/test-key-read-only.py
```

ไฟล์ `.env.example` ใน repo มีเฉพาะ placeholder ปลอม — ใช้เป็นต้นแบบให้ผู้ใช้อื่น

---

## 6. ข้อควรระวังเพิ่มเติม

1. **Revocation**: ถ้าคีเคยถูกเผยแพร่ ให้ลบทันทีที่ Binance → API Management แล้วสร้างคู่ใหม่
2. **IP Allowlist**: เพิ่ม IP ของเครื่องที่ใช้จริง (เช่น sandbox IP ของ Manus) เพื่อปิดกั้นการใช้จากที่อื่น
3. **Endpoint Geo**: ครัวเครื้ อข่ายบาง IP ถูกกีดกัน (451 Service unavailable) — ใช้ mirror `https://api1.binance.com` หรือ `https://data-api.binance.vision` เป็นแผนสำรอง
4. **ไม่ share คี่**: คี + secret = กุญแจเข้าบัญชี — อย่าใส่ในชัท โค้ดสาธารณะ หรือ commit
5. **Clock skew**: ถ้า server-time ผิดเกิน ±5000ms จะได้ -1021 — รัน `binance-cli spot server-time` เทียบกับนาฬิการะบบ
