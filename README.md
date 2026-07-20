# FileCub Office — Agent Office

"จัดการไฟล์อย่างชาญฉลาด ทำงานได้อย่างมืออาชีพ"

ฟีเจอร์ **Agent Office** เพิ่มทีมผู้ช่วย AI แบบ Pixel Agent จำนวน 7 ตัวเข้าไปใน
FileCub Office เพื่อเปลี่ยนโปรแกรมจัดการไฟล์ให้เป็น "AI Workforce สำหรับองค์กร"

ใช้ Logo Official ของ FileCub Office เท่านั้น — ไม่มีการสร้าง/แก้ไขโลโก้ในงานนี้

## เอกสารออกแบบ

ดูรายละเอียดสถาปัตยกรรมทั้งหมดได้ที่ [`docs/agent-office/`](docs/agent-office/00-overview.md):

1. [00-overview.md](docs/agent-office/00-overview.md) — ภาพรวมและหลักการออกแบบ
2. [01-architecture.md](docs/agent-office/01-architecture.md) — System Architecture, Tech Stack, Agent Core Contract
3. [02-database.md](docs/agent-office/02-database.md) — ERD และ Schema เต็ม
4. [03-ui-flow.md](docs/agent-office/03-ui-flow.md) — User Flow และ Screen Map
5. [04-component-structure.md](docs/agent-office/04-component-structure.md) — โครงสร้างโค้ดแบบ Modular
6. [05-development-plan.md](docs/agent-office/05-development-plan.md) — แผนพัฒนาเป็น Phase

## โครงสร้างโค้ดตั้งต้น (scaffold)

`src/agent-core` และ `src/agents/*` เป็น scaffold เริ่มต้นตามสถาปัตยกรรมในเอกสาร —
implement `IAgent` ครบทั้ง 7 ตัว (folder, search, upload, security, ai, notify, backup)
พร้อม event bus และ activity logger กลาง ยังไม่ผูก DB/UI จริง (ตาม Phase 0 ในแผนพัฒนา)

```
src/
├─ agent-core/      # registry, event bus, activity logger, bootstrap
├─ agents/          # 7 agent ตาม spec
└─ agent-dashboard/ # service สำหรับ Agent Office Dashboard
```
