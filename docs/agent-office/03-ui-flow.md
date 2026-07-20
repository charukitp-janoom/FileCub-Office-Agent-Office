# 03. UI Flow

## 3.1 Screen Map

```
Main App (FileCub Office)
 ├─ [เมนูเดิม] File Explorer / Search / Settings ...
 └─ [เมนูใหม่] 🤖 Agent Office
      ├─ 3.1  Agent Office Room  (หน้าแรกของโหมดนี้)
      │        └─ คลิก Character → 3.2 Agent Detail Drawer
      │                                 └─ เปิดใช้งาน Feature → เรียก use-case เดิมของระบบ
      │                                                          (เช่นเปิด Folder view ที่จัดแล้ว)
      ├─ 3.2  Agent Detail Drawer (modal)
      ├─ 3.3  Agent Office Dashboard
      ├─ 3.4  Achievement / Level Screen
      └─ 3.5  Notification Center (Cub Notify Agent)
```

## 3.2 Flow หลัก: เปิดเมนู Agent Office ครั้งแรก

```
[User คลิกเมนู "🤖 Agent Office"]
        │
        ▼
[โหลด agent registry + agent_activity_logs วันนี้ + user_levels]
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  Agent Office Room (Pixel scene, Blue/Green theme)            │
│                                                                │
│  [แถบบน]  USER: ADMIN  LEVEL 25 ▓▓▓▓▓▓▓░░░ 850/1200  🪙 2,560 │
│                                                                │
│  [ตัวละคร 7 ตัวยืนเรียงในออฟฟิศ พร้อม status indicator]        │
│   🗂️        🔍        ☁️        🛡️        🤖        📧        💾  │
│  Folder    Search    Upload   Security    AI      Notify   Backup │
│  ● idle    ● working ● idle   ● idle     ● idle   ●3 new  ● idle │
│                                                                │
│  [แถบล่าง] ปุ่มลัด: Dashboard | Achievement | ค้นหา...          │
└─────────────────────────────────────────────────────────────┘
        │  (คลิกตัวละครใดก็ได้)
        ▼
    → 3.3 Agent Detail Drawer
```

- status indicator ต่อ agent มาจาก `AgentStatus.state` (idle/working/error/disabled) —
  เช่น Notify Agent มี badge "3 new" มาจาก `SELECT COUNT(*) FROM notifications WHERE is_read=0`
- ตัวละครมี idle animation เบา ๆ ตลอดเวลา, เปลี่ยนเป็น "working" animation ขณะ agent
  กำลังรัน capability (subscribe ผ่าน AgentEventBus แบบ real-time)

## 3.3 Agent Detail Drawer

```
┌───────────────────────────────────────────┐
│  🗂️  Cub Folder Agent (น้องโฟลเดอร์)        │
│  File Organization Specialist               │
├───────────────────────────────────────────┤
│  สถานะ: ● กำลังทำงาน — จัดไฟล์ 12/20         │
│                                              │
│  ความสามารถ                                  │
│   [x] วิเคราะห์ไฟล์ใหม่อัตโนมัติ      [เปิด]  │
│   [x] Desktop Auto Import           [เปิด]  │
│   [ ] สร้าง Folder Structure เอง    [ปิด]   │
│                                              │
│  กิจกรรมล่าสุด (จาก agent_activity_logs)     │
│   • จัดไฟล์ "report-final.docx" → เอกสารรายงาน │
│   • จัดไฟล์ "scan001.pdf" → เอกสารสแกน        │
│                                              │
│  [ ดูไฟล์ที่จัดแล้ว ]   [ ตั้งค่ากฎการจัดหมวดหมู่ ] │
└───────────────────────────────────────────┘
```

รูปแบบ Drawer นี้เป็น **generic template** เดียวใช้กับ agent ทั้ง 7 ตัว โดย render จาก
`IAgent.capabilities[]` + `agent_activity_logs` ที่ filter ด้วย `agent_id` — ปุ่ม action
ท้าย drawer (เช่น "ดูไฟล์ที่จัดแล้ว") เท่านั้นที่ต่างกันตาม agent (config ผ่าน
`agentUIConfig[agentCode].primaryActions`)

## 3.4 ตัวอย่าง Flow เฉพาะ — Cub Search Agent

```
[คลิก Search Agent] → Drawer เปิด search box แทน capability list ปกติ
        │
        ▼
User พิมพ์: "หาเอกสารคำสั่งเดือนมกราคม"
        │
        ▼
[เรียก search-agent.runCapability('ai-search', { query })]
        │  → full-text query บน search_index (FTS5)
        │  → ถ้าเปิดใช้ AI Agent ร่วมด้วย: ส่งต่อให้ AI ช่วยตีความ query ภาษาไทย
        ▼
แสดงผล: "พบ 5 รายการ" + list พร้อม snippet + ปุ่มเปิดไฟล์
        │
        ▼
log agent_activity_logs (event: file.searched) → นับสถิติ Dashboard + Achievement
```

## 3.5 Flow เฉพาะ — Desktop Auto Import (Agent 1 + Agent 3 ทำงานร่วมกัน)

ตรงกับ feature เด่นในโปสเตอร์ "นำเข้าไฟล์จาก Desktop อัตโนมัติ"

```
[เปิดโหมด Auto ที่ Upload Agent]
        │
        ▼
chokidar watch Desktop path (desktop_watch_config)
        │  พบไฟล์ใหม่
        ▼
Upload Agent: ตรวจสอบไฟล์ (validation_status) → ผ่าน
        │  publish event "file.imported"
        ▼
Folder Agent: subscribe "file.imported" → จัดหมวดหมู่ตาม folder_rules
        │  publish event "file.organized"
        ▼
Notify Agent: subscribe "file.organized" → แจ้งเตือน "ย้ายไฟล์ X เข้าเอกสารรายงานแล้ว"
        │
        ▼
Achievement engine: +1 นับ criteria_event='file.organized'
        → ถ้าถึง 100 → ปลดล็อก 🏆 Desktop Cleaner + toast แสดงกลางจอ
```

## 3.6 Agent Office Dashboard

```
┌───────────────────────────────────────────────────────────┐
│  Agent Office Dashboard                                     │
├───────────────────────────────────────────────────────────┤
│  📄 ไฟล์วันนี้        24        📁 จัดระเบียบแล้ว      21     │
│  💾 ประหยัดพื้นที่     1.2 GB    ☁️ Backup แล้ว         340   │
│  🤖 งานที่ AI ช่วย     15                                    │
│                                                               │
│  [กราฟแนวโน้ม 7 วันล่าสุด — files_organized / backup]         │
│  [Agent ที่ active วันนี้: Folder, Upload, Notify]             │
└───────────────────────────────────────────────────────────┘
```

ข้อมูลมาจาก `dashboard_stats_daily` (materialized รายวันจาก `agent_activity_logs`
โดย scheduled job ทุกเที่ยงคืน + คำนวณ real-time สำหรับวันนี้ด้วย query สด)

## 3.7 Achievement / Level Screen

```
┌───────────────────────────────────────────────────────────┐
│  Level ปัจจุบัน: File Master  (คั่นกลาง: Beginner → Office   │
│  User → File Master → AI Commander)                         │
│  ▓▓▓▓▓▓▓▓░░  850 / 1200 EXP                                  │
├───────────────────────────────────────────────────────────┤
│  🏆 Desktop Cleaner   ✅ ปลดล็อกแล้ว (จัดไฟล์ 100/100)         │
│  🏆 File Guardian     ▓▓▓▓░░░░ 340/1000                       │
│  🔍 Search Master     ▓▓▓▓▓▓░░ 380/500                        │
│  🤖 AI Partner        🔒 ยังไม่เริ่ม                           │
└───────────────────────────────────────────────────────────┘
```

## 3.8 Accessibility / Responsive Notes

- Pixel scene ใช้ sprite sheet แต่ทุกปุ่ม/สถานะต้องมี text label คู่กันเสมอ (ไม่พึ่งสีอย่างเดียว)
- Drawer ต้อง keyboard-navigable (Tab/Enter/Esc) เพราะเป็น modal ทับ main content
- บนจอเล็ก (LAN client แบบ tablet) ให้ Agent Office Room ยุบเป็น grid 2 คอลัมน์แทนแถวเดียว
