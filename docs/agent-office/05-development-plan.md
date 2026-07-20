# 05. แผนพัฒนา (Development Plan)

หลักการแบ่ง phase: **สร้าง core + agent ที่ตอบ pain point เร่งด่วนสุดก่อน** (Desktop รก →
Folder/Upload Agent) แล้วค่อยเพิ่มความฉลาด (Search/AI) สุดท้ายค่อยเป็น
governance/gamification (Security/Backup/Achievement) ซึ่งไม่ block การใช้งานหลัก

## Phase 0 — Foundation (1–2 สัปดาห์)
- ตั้งโครง repo ตาม `04-component-structure.md`
- สร้าง `agent-core`: types, registry, event bus, activity-logger
- SQLite schema + migration runner (ตารางใน `02-database.md` ส่วน core + agent framework)
- Bootstrap 7 agent เป็น **stub** (implement `IAgent` แต่ capability ยังไม่ทำงานจริง)
  เพื่อให้ Agent Office Room render ได้ครบ 7 ตัวตั้งแต่ต้น
- Design token: สี Blue/Green ตาม brand, sprite placeholder 7 ตัว (pixel style)

**Milestone:** เปิดเมนู "🤖 Agent Office" เห็นตัวละครครบ 7 ตัว คลิกแล้วเปิด Drawer ได้
(ยังไม่มี logic จริง)

## Phase 1 — Core File Agents (2–3 สัปดาห์)
- **Cub Folder Agent**: rules-engine, file_categories seed, auto-organize on `file.imported`
- **Cub Upload Agent**: desktop-watcher (chokidar), file validator, scan import
- เชื่อม event `file.imported → file.organized` ผ่าน event bus จริง
- Dashboard tile พื้นฐาน: ไฟล์วันนี้ / จัดระเบียบแล้ว (query สดจาก `agent_activity_logs`)

**Milestone:** ทำ Desktop Auto Import ได้ตามภาพในโปสเตอร์ (ก่อน/หลัง)

## Phase 2 — Search & AI (2–3 สัปดาห์)
- **Cub Search Agent**: SQLite FTS5 index, thai-query normalize, UI search box
- **Cub AI Agent**: LLM client (Claude API), summarize PDF, chat-with-document,
  suggest-filename, ผูกกับปุ่ม "แนะนำการจัดเก็บไฟล์" ใน Folder Agent (agent ต่อ agent
  ผ่าน event `ai.summary_ready`)

**Milestone:** พิมพ์ค้นหาภาษาไทยได้ผลลัพธ์ถูกต้อง, สรุปเอกสารได้จริง

## Phase 3 — Governance (2 สัปดาห์)
- **Cub Security Agent**: RBAC (Admin/Staff/Viewer), permission middleware ครอบทุก endpoint,
  anomaly detector เบื้องต้น (เช่น ลบไฟล์จำนวนมากผิดปกติในเวลาสั้น)
- **Cub Backup Agent**: backup job scheduler, versioning, restore usecase, storage status

**Milestone:** เปลี่ยน role ผู้ใช้แล้วสิทธิ์เปลี่ยนจริง, backup อัตโนมัติทำงานตาม schedule
และ restore ได้

## Phase 4 — Notify + Dashboard เต็มรูปแบบ (1–2 สัปดาห์)
- **Cub Notify Agent**: subscribe ทุก event สำคัญจาก agent อื่น → สร้าง notification
- Notification Center UI (badge นับ unread บนตัวละคร)
- `agent-dashboard`: stats-aggregator cron job, dashboard trend 7 วัน, กราฟ

**Milestone:** Dashboard ครบตามสเปค (ไฟล์วันนี้/จัดระเบียบแล้ว/พื้นที่ประหยัด/backup/AI tasks)

## Phase 5 — Achievement & Gamification (1 สัปดาห์)
- `achievement-engine` เป็น consumer ของ activity log
- seed achievements (Desktop Cleaner, File Guardian, Search Master, AI Partner, ...)
- Level system (Beginner → Office User → File Master → AI Commander) + EXP mapping
  ต่อ event type (กำหนดใน config ไม่ hardcode ใน agent)
- UI: Achievement/Level screen, toast ปลดล็อกกลางจอ, progress bar บนแถบบน

**Milestone:** ปลดล็อก achievement จริงเมื่อ threshold ถึง, level ขึ้นจริง

## Phase 6 — Polish & Hardening (1–2 สัปดาห์)
- Pixel animation จริง (idle/working/talk) แทน placeholder sprite
- Performance: index ตาราง log, batching stats aggregation, lazy-load sprite assets
- Security review: RBAC edge case, permission bypass, injection บน search query
- Offline/LAN test: ปิดเน็ตแล้วทุก agent core feature (folder/upload/search/backup local)
  ต้องยังทำงานได้ — AI Agent เท่านั้นที่ degrade gracefully เมื่อไม่มีเน็ต
- เอกสารผู้ใช้ + onboarding tour (สอดคล้องกับ "ทดลองใช้ฟรี 1 เดือน" ในโปสเตอร์)

**Milestone:** พร้อม release (RC) — ทุก agent ทำงานครบ, ผ่าน security review

## สรุป Timeline โดยประมาณ

| Phase | ระยะเวลา | ผลลัพธ์หลัก |
|---|---|---|
| 0 | 1–2 สัปดาห์ | โครง Agent Office ครบ 7 ตัว (stub) |
| 1 | 2–3 สัปดาห์ | Desktop Auto Import ใช้งานได้จริง |
| 2 | 2–3 สัปดาห์ | Search + AI ใช้งานได้จริง |
| 3 | 2 สัปดาห์ | RBAC + Backup ใช้งานได้จริง |
| 4 | 1–2 สัปดาห์ | Notify + Dashboard เต็มรูปแบบ |
| 5 | 1 สัปดาห์ | Achievement/Level ใช้งานได้จริง |
| 6 | 1–2 สัปดาห์ | Polish, security review, พร้อม release |
| **รวม** | **~10–15 สัปดาห์** | |

## Risk / จุดที่ต้องตัดสินใจก่อนเริ่ม Phase 0

1. **Stack เดิมของ FileCub Office คืออะไร** — เอกสารนี้สมมติ Electron+React+SQLite
   ถ้าของจริงเป็น Web app บน stack อื่น ต้อง map `agent-core` เข้ากับ backend เดิม
   (contract ใน `01-architecture.md` §1.3 เป็น platform-agnostic อยู่แล้ว)
2. **AI Provider** — เอกสารเสนอ Claude API แต่ต้องยืนยันเรื่อง data residency/PDPA
   ถ้าเอกสารลูกค้าเป็นข้อมูลอ่อนไหว
3. **Search ภาษาไทย** — SQLite FTS5 ต้องเสริม Thai word-segmentation (เช่น lib
   `newmm`/PyThaiNLP ฝั่ง service แยก หรือ ICU tokenizer) มิฉะนั้นค้นหาคำไทยจะไม่แม่น
4. **Sync/Cloud server** เป็น optional — ถ้าลูกค้าต้องการ multi-device ทันที ต้องเลื่อน
   งานนี้เข้ามาใน Phase 1 แทน Phase 6
