# 04. Component Structure (Modular)

## 4.1 โครงสร้างโฟลเดอร์เต็ม

```
src/
├─ agent-core/                      # ชั้นกลาง platform-agnostic
│   ├─ types.ts                     # IAgent, AgentContext, AgentStatus, ...
│   ├─ registry.ts                  # AgentRegistry
│   ├─ event-bus.ts                 # AgentEventBus implementation
│   ├─ permission-checker.ts        # ผูกกับ Security Agent
│   ├─ activity-logger.ts           # persist agent_activity_logs อัตโนมัติ
│   ├─ achievement-engine.ts        # consumer ของ event → ปลดล็อก achievement
│   ├─ bootstrap.ts                 # จุดเดียวที่ register agent ทั้งหมด
│   └─ index.ts
│
├─ agents/
│   ├─ folder-agent/
│   │   ├─ folder-agent.ts          # implements IAgent
│   │   ├─ rules-engine.ts          # จับคู่ folder_rules
│   │   ├─ desktop-scanner.ts       # ตรวจ Desktop รก
│   │   └─ folder-agent.repository.ts
│   │
│   ├─ search-agent/
│   │   ├─ search-agent.ts
│   │   ├─ fts-index.service.ts     # เขียน/query SQLite FTS5
│   │   └─ thai-query.util.ts       # normalize คำค้นภาษาไทย
│   │
│   ├─ upload-agent/
│   │   ├─ upload-agent.ts
│   │   ├─ desktop-watcher.service.ts  # chokidar wrapper
│   │   ├─ scan-import.service.ts
│   │   └─ file-validator.ts
│   │
│   ├─ security-agent/
│   │   ├─ security-agent.ts
│   │   ├─ rbac.service.ts          # Admin/Staff/Viewer
│   │   └─ anomaly-detector.ts
│   │
│   ├─ ai-agent/
│   │   ├─ ai-agent.ts
│   │   ├─ llm-client.ts            # wrapper เรียก Claude API
│   │   ├─ summarize.usecase.ts
│   │   ├─ chat-with-document.usecase.ts
│   │   └─ suggest-filename.usecase.ts
│   │
│   ├─ notify-agent/
│   │   ├─ notify-agent.ts
│   │   └─ notification.repository.ts
│   │
│   └─ backup-agent/
│       ├─ backup-agent.ts
│       ├─ backup-scheduler.ts
│       ├─ versioning.service.ts
│       └─ restore.usecase.ts
│
├─ agent-dashboard/
│   ├─ dashboard.service.ts         # รวม stats จาก agent_activity_logs
│   ├─ stats-aggregator.job.ts      # cron รายวัน → dashboard_stats_daily
│   └─ dashboard.controller.ts      # API สำหรับ frontend
│
└─ shared/
    ├─ db/                          # SQLite client, migrations
    ├─ types/
    └─ config/

apps/
├─ desktop/                         # Electron shell (main + preload)
└─ web-ui/                          # React app
    └─ src/
        ├─ features/
        │   ├─ agent-office/
        │   │   ├─ AgentOfficeRoom.tsx        # Pixel scene, 3.2
        │   │   ├─ AgentSprite.tsx             # ตัวละคร 1 ตัว + status badge
        │   │   ├─ AgentDetailDrawer.tsx       # generic drawer, 3.3
        │   │   ├─ agentUIConfig.ts            # primaryActions ต่อ agent
        │   │   └─ useAgentRegistry.ts         # hook ดึง agent + status
        │   │
        │   ├─ agent-dashboard/
        │   │   ├─ AgentDashboardPage.tsx
        │   │   └─ StatTile.tsx
        │   │
        │   ├─ achievement/
        │   │   ├─ AchievementPage.tsx
        │   │   ├─ LevelProgressBar.tsx
        │   │   └─ AchievementBadge.tsx
        │   │
        │   └─ notifications/
        │       └─ NotificationCenter.tsx
        │
        └─ shared-ui/
            ├─ theme/                          # Blue/Green brand tokens
            └─ pixel-assets/                   # sprite sheets (ตัวละคร 7 ตัว)
```

## 4.2 ทำไม `agent-core` แยกจาก `agents/*` เด็ดขาด

- `agent-core` **import ไม่ได้** จากโค้ดของ agent เฉพาะเจาะจงตัวใดเลย (enforced ด้วย
  ESLint boundary rule เช่น `no-restricted-imports`) — รับประกันว่า core ยังใช้ได้แม้ลบ
  agent ตัวใดตัวหนึ่งทิ้ง
- ทุก agent import จาก `agent-core` เท่านั้น ไม่ import ข้ามกันโดยตรง (เช่น folder-agent
  ห้าม import จาก notify-agent) — การสื่อสารข้าม agent ทำผ่าน **event bus เท่านั้น**
  เพื่อไม่ให้เกิด tight coupling / circular dependency

## 4.3 Frontend: 1 Template ใช้กับ Agent 7 ตัว

`AgentDetailDrawer.tsx` เป็น **generic component เดียว** ที่รับ `agentCode` แล้ว render
capabilities/log จาก API กลาง (`/api/agents/:code`, `/api/agents/:code/activity`)
ส่วนที่ต่างกันต่อ agent (เช่น Search มีช่องค้นหาแทน toggle list) กำหนดผ่าน
`agentUIConfig.ts`:

```ts
// apps/web-ui/src/features/agent-office/agentUIConfig.ts
export const agentUIConfig: Record<AgentCode, AgentUIConfig> = {
  folder: { layout: "capability-list", primaryActions: ["view-organized", "edit-rules"] },
  search: { layout: "search-box",       primaryActions: ["advanced-search"] },
  upload: { layout: "capability-list", primaryActions: ["open-desktop-watch-settings"] },
  security:{ layout: "capability-list", primaryActions: ["view-activity-log", "manage-roles"] },
  ai:      { layout: "chat",            primaryActions: ["new-conversation"] },
  notify:  { layout: "notification-list", primaryActions: ["mark-all-read"] },
  backup:  { layout: "capability-list", primaryActions: ["run-backup-now", "view-versions"] },
};
```

การเพิ่ม agent ใหม่ในอนาคต = เพิ่ม entry ใน `agentUIConfig` + backend `IAgent`
implementation เท่านั้น ไม่ต้องเขียน component ใหม่

## 4.4 REST API Surface (สำหรับ agent-core + agent-dashboard)

```
GET    /api/agents                        # list agent + status ปัจจุบัน
GET    /api/agents/:code                  # detail + capabilities
POST   /api/agents/:code/capabilities/:key/toggle
POST   /api/agents/:code/run              # trigger capability แบบ manual
GET    /api/agents/:code/activity?limit=  # activity log ของ agent นั้น

GET    /api/dashboard/summary             # ตัวเลข dashboard วันนี้
GET    /api/dashboard/trend?days=7

GET    /api/achievements
GET    /api/achievements/me
GET    /api/levels/me

GET    /api/notifications?unread=true
POST   /api/notifications/:id/read
```

ทุก endpoint ผ่าน middleware เดียวกันที่เรียก `security-agent` เพื่อเช็ค RBAC ก่อนเสมอ
