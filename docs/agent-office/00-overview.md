# FileCub Office — Agent Office
## เอกสารออกแบบระบบ (System Design Document)

> โปรเจกต์นี้เป็น greenfield (repo ยังไม่มีโค้ดเดิม) เอกสารชุดนี้จึงทำหน้าที่เป็น
> พิมพ์เขียวตั้งต้นสำหรับทีมพัฒนา ก่อนเริ่มลงมือ implement

### ขอบเขตเอกสาร

| ไฟล์ | เนื้อหา |
|---|---|
| `01-architecture.md` | System Architecture, Tech Stack, Agent Framework |
| `02-database.md` | ERD และ Schema ทั้งหมด |
| `03-ui-flow.md` | User Flow, Screen Map, Wireframe (text-based) |
| `04-component-structure.md` | โครงสร้างโค้ด Frontend/Backend แบบ Modular |
| `05-development-plan.md` | แผนพัฒนาเป็น Phase พร้อม Milestone |

### หลักการออกแบบหลัก (Design Principles)

1. **Brand Lock** — ห้ามแก้โลโก้/สร้างโลโก้ใหม่ ใช้ Logo Official ของ FileCub Office เท่านั้น
   ทุก Agent เป็นเพียง "ตัวละครเสริม" ที่อยู่ภายใต้ brand เดิม ไม่ใช่ sub-brand ใหม่
2. **Agent = Plugin** — Agent แต่ละตัวคือโมดูลอิสระที่ implement interface กลาง (`IAgent`)
   เพิ่ม Agent ตัวที่ 8, 9, ... ได้โดยไม่แตะโค้ด Agent เดิม (Open/Closed Principle)
3. **Core ไม่รู้จัก Agent เฉพาะเจาะจง** — `agent-core` รู้จักแค่ contract กลาง
   (register, capability, event, permission) ส่วน business logic เฉพาะทางอยู่ใน `agents/*`
4. **Everything is an Event** — ทุกการกระทำของ Agent (จัดไฟล์ 1 ไฟล์, แจ้งเตือน 1 ครั้ง,
   backup 1 job) ถูกบันทึกเป็น `agent_activity_log` เพื่อใช้ต่อยอด Dashboard และ Achievement
   โดยไม่ต้องเขียน logic นับสถิติซ้ำในแต่ละ Agent
5. **Offline-first** — รองรับ LAN/ออฟไลน์ตาม pain point ที่ระบุในโปสเตอร์ ดังนั้น local storage
   (SQLite) เป็น source of truth หลัก และ sync ขึ้น server ส่วนกลางเป็น optional layer
