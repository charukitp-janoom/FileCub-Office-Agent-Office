# 06. คู่มือผู้ใช้ (User Guide)

เอกสารนี้ครอบคลุมการใช้งาน Agent Office จริงตามที่ implement แล้ว (Phase 0–5)
ไม่ใช่การออกแบบเชิงทฤษฎีเหมือนเอกสารก่อนหน้า — ทุกฟีเจอร์ที่อธิบายด้านล่างรันได้จริง

## เริ่มต้นใช้งาน (โหมดพัฒนา — สองพอร์ต, hot reload)

```bash
npm install
npm run build          # คอมไพล์ + คัดลอก migration SQL
npm run dev:api        # เปิด API server (port 4000, สร้าง agent-office.sqlite อัตโนมัติ)
```

เปิดอีก terminal สำหรับหน้าเว็บ:

```bash
cd apps/web-ui
npm install
npm run dev             # เปิด http://localhost:5173
```

ครั้งแรกที่รัน ระบบจะ:
- สร้างไฟล์ฐานข้อมูล `agent-office.sqlite` และรัน migration ทั้งหมดอัตโนมัติ
- สร้างโฟลเดอร์สาธิต `demo-desktop/` (ใช้แทน Desktop จริงสำหรับทดสอบ Desktop Auto Import)
- สร้างผู้ใช้ `demo-admin` สิทธิ์ admin โดยอัตโนมัติ

## ใช้งานจริง (Production — พอร์ตเดียว)

โหมดนี้เหมาะกับการรันค้างไว้ใช้งานจริง (ไม่ใช่ระหว่างพัฒนา): build เว็บเป็นไฟล์ static
แล้วให้ API server ตัวเดียวกันเสิร์ฟทั้ง API และหน้าเว็บบนพอร์ตเดียว — ไม่ต้องเปิด
Vite dev server ค้างไว้ ไม่ต้องตั้งค่า CORS/proxy เพิ่ม เพราะทุกอย่างอยู่ origin เดียวกัน

```bash
npm install
npm run build:all      # build ทั้ง API (dist/) และเว็บ (apps/web-ui/dist/)
npm start               # เปิด http://localhost:4000 — มีทั้ง API และหน้าเว็บ
```

ตัวแปรแวดล้อมที่ปรับได้:

| ตัวแปร | ค่าเริ่มต้น | ใช้ทำอะไร |
|---|---|---|
| `PORT` | `4000` | พอร์ตที่ server ฟัง |
| `DB_PATH` | `agent-office.sqlite` | path ของไฟล์ฐานข้อมูล |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | origin ที่อนุญาตให้เรียก API แบบ cross-origin (ไม่เกี่ยวกับโหมด production พอร์ตเดียว ซึ่ง same-origin อยู่แล้ว — ใช้เมื่อรัน frontend แยกพอร์ต/โดเมน) |
| `STATIC_DIR` | `apps/web-ui/dist` | เปลี่ยน path เว็บที่จะเสิร์ฟ, ตั้งเป็นค่าว่าง (`STATIC_DIR=`) เพื่อปิดการเสิร์ฟเว็บ (API-only) |

### รันค้างไว้เบื้องหลังแบบถาวร (auto-restart, auto-start ตอนเปิดเครื่อง)

บน Linux ที่มี systemd สร้างไฟล์ `/etc/systemd/system/filecub-agent-office.service`:

```ini
[Unit]
Description=FileCub Office Agent Office
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/filecub-office-agent-office
ExecStart=/usr/bin/npm start
Restart=on-failure
Environment=PORT=4000
Environment=DB_PATH=/path/to/filecub-office-agent-office/agent-office.sqlite

[Install]
WantedBy=multi-user.target
```

แล้วรัน:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now filecub-agent-office
sudo systemctl status filecub-agent-office   # ดูสถานะ
journalctl -u filecub-agent-office -f        # ดู log แบบ real-time
```

ทุกครั้งที่อัปเดตโค้ด: `git pull && npm run build:all && sudo systemctl restart filecub-agent-office`

## เข้าสู่ระบบ (Login)

ตั้งแต่มีระบบยืนยันตัวตน (ดู `SECURITY.md`) หน้าเว็บจะไม่พาเข้า Agent Office
โดยตรงอีกต่อไป — เปิด `http://localhost:5173` ครั้งแรกจะเจอหน้า **ตั้งรหัสผ่าน**:

1. กรอกรหัสผ่านอย่างน้อย 8 ตัวอักษร (สำหรับเครื่อง/instance นี้เท่านั้น ไม่ใช่ระบบ
   หลายผู้ใช้ — ดูรายละเอียดใน `SECURITY.md`) แล้วกดยืนยัน
2. ระบบจะพาเข้า Agent Office ทันที และจำ session ไว้ในคุกกี้ 30 วัน

ครั้งถัดไปที่เปิดเว็บ (หรือหลังกด **ออกจากระบบ** ที่มุมขวาบน) จะเจอหน้า
**เข้าสู่ระบบ** ให้กรอกรหัสผ่านเดิม ใส่รหัสผ่านผิดติดต่อกัน 5 ครั้งจะถูกล็อกชั่วคราว
15 นาที (ป้องกันการเดารหัสผ่าน)

รหัสผ่านนี้ตั้งได้ครั้งเดียวผ่านหน้าเว็บ — ยังไม่มีหน้า "เปลี่ยนรหัสผ่าน"
ถ้าลืมรหัสผ่าน ต้องลบคอลัมน์ `password_hash`/`password_salt` ของผู้ใช้ใน
`agent-office.sqlite` โดยตรงแล้วตั้งใหม่ผ่านหน้าเว็บ

## ทัวร์ Agent ทั้ง 7 ตัว

### 🗂️ น้องโฟลเดอร์ (Cub Folder Agent)
จัดหมวดหมู่ไฟล์ให้อัตโนมัติทันทีที่มีไฟล์ใหม่เข้าระบบ (ผ่าน Upload Agent) ตามกฎที่ตั้งไว้:
`report*`/`.docx` → เอกสารรายงาน, `scan*`/`.pdf` → เอกสารสแกน, `img*`/`.jpg` → รูปภาพ
ไม่มีปุ่มสั่งรันเอง เพราะทำงานอัตโนมัติตาม event เสมอ — ดูผลได้จาก "กิจกรรมล่าสุด" ใน Drawer

### 🔍 น้องเซิร์ช (Cub Search Agent)
เปิด Drawer แล้วพิมพ์คำค้นบางส่วนของชื่อไฟล์หรือหมวดหมู่ (รองรับภาษาไทยแบบค้นหาบางส่วน
ไม่ต้องพิมพ์คำเต็ม เช่น "มกราคม" หาเจอ "เอกสารคำสั่งเดือนมกราคม.pdf") ต้องพิมพ์อย่างน้อย
3 ตัวอักษรจึงจะค้นเจอ (ข้อจำกัดของการค้นหาแบบ trigram)

### ☁️ น้องอัป (Cub Upload Agent)
กด **"เปิดโหมด Auto"** ใน Drawer เพื่อเปิด Desktop Auto Import — ระบบจะเฝ้าดูโฟลเดอร์สาธิต
(`demo-desktop/`) และนำเข้าไฟล์ใหม่ที่วางลงไปโดยอัตโนมัติ ลองสร้างไฟล์ในโฟลเดอร์นั้นแล้วดู
Folder Agent จัดหมวดหมู่ให้ทันที

### 🛡️ น้องชิลด์ (Cub Security Agent)
กด **"ตรวจสอบ Activity Log"** ดูประวัติการตรวจสอบสิทธิ์ล่าสุด ความสามารถอื่น (Role Permission,
ป้องกันไฟล์สำคัญ) เรียกผ่าน API โดยตรง (`POST /api/agents/security/run`) — ดูรูปแบบ payload
ได้ใน `04-component-structure.md §4.4`

### 🤖 น้องคิวบ์ (Cub AI Agent)
ถามคำถามเกี่ยวกับโปรแกรมได้เลยในช่อง "ถาม Cub AI" — ถ้าไม่ได้ตั้งค่า `ANTHROPIC_API_KEY`
ระบบจะตอบจาก FAQ ออฟไลน์ที่มีอยู่ (คำสำคัญ: ค้นหา, จัดหมวดหมู่, สำรอง, Desktop อัตโนมัติ)
ถ้าตั้งค่า API key ไว้ (ดูด้านล่าง) จะได้คำตอบจาก Claude จริง

### 📧 น้องนิว (Cub Notify Agent)
ได้รับการแจ้งเตือนอัตโนมัติทุกครั้งที่: ไฟล์ถูกจัดหมวดหมู่, พบความผิดปกติ, สำรองข้อมูล
สำเร็จ/ล้มเหลว, หรือปลดล็อก Achievement ใหม่ — badge สีแดงบนตัวละครแสดงจำนวนที่ยังไม่อ่าน

### 💾 น้องแบ็ก (Cub Backup Agent)
กด **"สำรองข้อมูลตอนนี้"** เพื่อสำรองไฟล์ทั้งหมด ระบบเก็บทุกเวอร์ชันแยกตามไฟล์ (ไม่เขียนทับ)
กู้คืนไฟล์และดูพื้นที่ใช้งานได้ผ่าน API (`restore-file`, `storage-check`)

## 🏆 Achievement & Level

กดปุ่ม **"Achievement"** ที่แถบบนเพื่อดูภาพรวมความสำเร็จและ Level ปัจจุบัน
(Beginner → Office User → File Master → AI Commander) เมื่อปลดล็อก achievement ใหม่
จะมี toast แจ้งเตือนขึ้นกลางจอโดยอัตโนมัติ

## ตั้งค่า AI จริง (ไม่บังคับ)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev:api
```

ถ้าไม่ตั้งค่า Cub AI Agent ยังใช้งานได้ปกติผ่าน fallback ออฟไลน์ (ดู
`src/agents/ai-agent/llm-client.ts`)

## ข้อจำกัดที่ควรรู้ก่อนใช้งานจริง

- **ยังเป็นระบบผู้ใช้คนเดียว (single-tenant)** — มีระบบ login ด้วยรหัสผ่านแล้ว แต่ทุก session
  ที่ล็อกอินสำเร็จทำงานในนามผู้ใช้ admin คนเดียวกันเสมอ ยังไม่รองรับหลายบัญชีแยกสิทธิ์กัน
  เหมาะกับการใช้งานคนเดียวหรือในเครือข่ายที่เชื่อถือได้เท่านั้น อย่าเปิดพอร์ตนี้ออกสู่
  อินเทอร์เน็ตสาธารณะ — ดูรายละเอียดใน `SECURITY.md`
- **ยังไม่รองรับการอ่านเนื้อหาเอกสารจริง** (PDF/DOCX parsing) — Cub AI Agent และ Cub Search
  Agent ทำงานกับชื่อไฟล์และหมวดหมู่เป็นหลัก ยังไม่ดึงเนื้อหาข้างในเอกสารมาสรุป/ค้นหาโดยอัตโนมัติ
