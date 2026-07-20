# FileCub Office — Agent Office

"จัดการไฟล์อย่างชาญฉลาด ทำงานได้อย่างมืออาชีพ"

ฟีเจอร์ **Agent Office** เพิ่มทีมผู้ช่วย AI แบบ Pixel Agent จำนวน 7 ตัวเข้าไปใน
FileCub Office เพื่อเปลี่ยนโปรแกรมจัดการไฟล์ให้เป็น "AI Workforce สำหรับองค์กร"
ทุก Agent ทำงานได้จริง (ไม่ใช่ mockup) — ดูวิธีใช้งานได้ที่คู่มือผู้ใช้ด้านล่าง

ใช้ Logo Official ของ FileCub Office เท่านั้น — ไม่มีการสร้าง/แก้ไขโลโก้ในงานนี้

## เริ่มต้นใช้งานเร็ว

```bash
npm install && npm run build && npm run dev:api   # API server, port 4000
cd apps/web-ui && npm install && npm run dev        # เว็บ UI, http://localhost:5173
```

รายละเอียดเต็มดูที่ [`docs/agent-office/06-user-guide.md`](docs/agent-office/06-user-guide.md)

## เอกสาร

ดูรายละเอียดสถาปัตยกรรมทั้งหมดได้ที่ [`docs/agent-office/`](docs/agent-office/00-overview.md):

1. [00-overview.md](docs/agent-office/00-overview.md) — ภาพรวมและหลักการออกแบบ
2. [01-architecture.md](docs/agent-office/01-architecture.md) — System Architecture, Tech Stack, Agent Core Contract
3. [02-database.md](docs/agent-office/02-database.md) — ERD และ Schema เต็ม
4. [03-ui-flow.md](docs/agent-office/03-ui-flow.md) — User Flow และ Screen Map
5. [04-component-structure.md](docs/agent-office/04-component-structure.md) — โครงสร้างโค้ดแบบ Modular
6. [05-development-plan.md](docs/agent-office/05-development-plan.md) — แผนพัฒนาเป็น Phase
7. [06-user-guide.md](docs/agent-office/06-user-guide.md) — คู่มือผู้ใช้ (Phase 6)
8. [SECURITY.md](SECURITY.md) — ผลการทำ security review ก่อน release (Phase 6)

## โครงสร้างโค้ด

```
src/
├─ agent-core/       # registry, event bus, activity logger, RBAC, achievement engine, bootstrap
├─ agents/           # 7 agent — folder, search, upload, security, ai, notify, backup
├─ agent-dashboard/  # dashboard service + stats-aggregator job
├─ shared/db/        # SQLite client, migrations, repositories
└─ server/           # REST API (node:http, ไม่พึ่ง framework)

apps/web-ui/          # React + Vite — Agent Office Room, Achievement/Level, Notification Center
```

Agent ทั้ง 7 ตัวทำงานได้จริงบน SQLite จริง มี test suite ครอบคลุม (`npm test`)
ครบทุก Phase (0–6) ตามแผนใน `05-development-plan.md`
