# 01. System Architecture

## 1.1 ภาพรวมระดับสูง

```
┌──────────────────────────────────────────────────────────────────────┐
│                         FileCub Office App                           │
│                    (Desktop: Electron + React)                       │
│                                                                        │
│  ┌────────────────┐   ┌─────────────────────────────────────────┐   │
│  │  File Manager   │   │            Agent Office (ใหม่)           │   │
│  │  (ระบบเดิม)      │   │  - Pixel Office Scene                    │   │
│  │  - Explorer     │   │  - Agent Dashboard                       │   │
│  │  - Preview      │   │  - Achievement System                    │   │
│  └────────┬────────┘   └─────────────────┬─────────────────────┘   │
│           │                              │                          │
│           └──────────────┬───────────────┘                          │
│                           ▼                                          │
│              ┌─────────────────────────┐                            │
│              │      Agent Core SDK      │  ← ชั้นกลาง ไม่รู้จัก Agent │
│              │  (Registry / EventBus /  │    เฉพาะเจาะจง             │
│              │   Permission / Scheduler)│                            │
│              └────────────┬─────────────┘                            │
│                           │ implements IAgent                        │
│   ┌──────┬──────┬───────┬─────────┬──────┬────────┬─────────┐       │
│   ▼      ▼      ▼       ▼         ▼      ▼        ▼          │       │
│ Folder Search Upload Security   AI     Notify   Backup       │       │
│ Agent  Agent  Agent   Agent    Agent   Agent    Agent        │       │
│   │      │      │       │         │      │        │          │       │
└───┼──────┼──────┼───────┼─────────┼──────┼────────┼──────────┘       │
    │      │      │       │         │      │        │
    ▼      ▼      ▼       ▼         ▼      ▼        ▼
┌────────────────────────────────────────────────────────┐
│                  Local Service Layer                    │
│  FS Watcher │ Full-text Index │ AI Runtime │ Job Queue   │
│  (chokidar) │ (SQLite FTS5)   │ (LLM API)  │ (cron/bull) │
└──────────────────────┬───────────────────────────────────┘
                        ▼
            ┌────────────────────────┐
            │   SQLite (local, WAL)   │  ← source of truth (offline-first)
            └───────────┬─────────────┘
                        │ optional sync
                        ▼
            ┌────────────────────────┐
            │  Sync/Backup Server API │  (LAN server หรือ Cloud, optional)
            │  Postgres + Object      │
            │  Storage (backup files) │
            └────────────────────────┘
```

## 1.2 Tech Stack ที่แนะนำ

| Layer | เทคโนโลยี | เหตุผล |
|---|---|---|
| Desktop shell | Electron | ต้องเข้าถึง Desktop/Filesystem จริงเพื่อทำ "Desktop Auto Import" |
| UI | React + TypeScript + Zustand/Redux | คอมโพเนนต์ Pixel Agent เป็น interactive sprite, ต้องการ state management เบาและ predictable |
| Pixel rendering | PixiJS หรือ CSS-sprite animation | แสดงห้อง Pixel Office และ Character animation (idle/talk/working) |
| Local DB | SQLite (better-sqlite3) + FTS5 | offline-first, full-text search ภาษาไทยสำหรับ Cub Search Agent |
| Background jobs | node-cron + in-process queue | งาน backup อัตโนมัติ, notify, desktop watcher |
| File watcher | chokidar | ตรวจจับไฟล์ใหม่บน Desktop แบบ real-time |
| AI runtime | Claude API (Anthropic) ผ่าน backend proxy | สรุปเอกสาร, ตั้งชื่อไฟล์, ตอบคำถาม (Cub AI Agent) |
| Sync/Cloud (optional) | Node.js (NestJS) + PostgreSQL + S3-compatible storage | รองรับ multi-device / องค์กรที่ต้องการ central backup |
| Auth/Role | JWT + RBAC (Admin/Staff/Viewer) | ใช้ร่วมกับ Cub Security Agent |

> หมายเหตุ: ถ้า FileCub Office เดิมมี stack อยู่แล้ว (เช่นเป็น Web app ไม่ใช่ Electron)
> ให้แทนที่ "Desktop shell" ด้วย stack เดิม — ส่วนที่เป็นหัวใจของงานนี้คือ **Agent Core
> Contract** ในหัวข้อ 1.3 ซึ่ง platform-agnostic

## 1.3 Agent Core Contract (หัวใจของสถาปัตยกรรม)

ทุก Agent implement interface เดียวกัน เพื่อให้ Agent Office, Dashboard และ Achievement
ทำงานกับ Agent ใดก็ได้โดยไม่ต้อง hardcode

```ts
// src/agent-core/types.ts

export type AgentCode =
  | "folder" | "search" | "upload"
  | "security" | "ai" | "notify" | "backup";

export interface AgentCapability {
  key: string;                 // เช่น "auto-organize", "desktop-watch"
  labelTh: string;
  descriptionTh: string;
  enabled: boolean;
  requiresPermission?: string; // ผูกกับ Security Agent (RBAC)
}

export interface AgentStatus {
  state: "idle" | "working" | "error" | "disabled";
  lastRunAt?: string;
  message?: string;            // ข้อความ pixel bubble เช่น "กำลังจัดไฟล์ 12 รายการ"
  progress?: number;           // 0-100 ถ้ามีงานที่ track ได้
}

export interface AgentContext {
  userId: string;
  eventBus: AgentEventBus;
  db: AgentDataAccess;         // repository ที่ scope เฉพาะ agent นั้น
  permissions: PermissionChecker;
  logger: AgentLogger;
}

export interface IAgent {
  code: AgentCode;
  nameTh: string;               // "Cub Folder Agent"
  nicknameTh: string;           // "น้องโฟลเดอร์"
  roleTitleTh: string;          // "File Organization Specialist"
  icon: string;                 // sprite asset key
  capabilities: AgentCapability[];

  init(ctx: AgentContext): Promise<void>;
  getStatus(): AgentStatus;
  runCapability(key: string, payload?: unknown): Promise<AgentRunResult>;
  onEvent?(event: AgentEvent): Promise<void>;   // subscribe เหตุการณ์จาก agent อื่น
  dispose(): Promise<void>;
}

export interface AgentRunResult {
  success: boolean;
  summaryTh: string;            // ใช้แสดงใน Activity Log / Notify
  expGained?: number;           // ผูกกับระบบ Achievement/Level
  data?: unknown;
}
```

### Agent Registry

```ts
// src/agent-core/registry.ts
export class AgentRegistry {
  private agents = new Map<AgentCode, IAgent>();

  register(agent: IAgent) { this.agents.set(agent.code, agent); }
  get(code: AgentCode) { return this.agents.get(code); }
  list(): IAgent[] { return [...this.agents.values()]; }
}
```

การเพิ่ม Agent ใหม่ในอนาคต (Agent 8, 9, ...) ทำได้โดย:
1. สร้างโฟลเดอร์ `src/agents/<new>-agent`
2. Implement `IAgent`
3. เรียก `registry.register(new NewAgent())` ที่จุด bootstrap เดียว (`agent-core/bootstrap.ts`)

ไม่ต้องแก้ Agent Office UI, Dashboard หรือ Achievement engine เลย เพราะทั้งหมดอ่านจาก
`registry.list()` และ `agent_activity_log` แบบ generic

## 1.4 Event Bus — จุดเชื่อม Agent ต่าง ๆ เข้าด้วยกัน

Agent หลายตัวต้องคุยกัน เช่น:
- Upload Agent นำเข้าไฟล์เสร็จ → ยิง event `file.imported` → Folder Agent ฟังแล้วจัดหมวดหมู่ต่อ
- Folder Agent จัดไฟล์เสร็จ → ยิง `file.organized` → Notify Agent แจ้งเตือน + Achievement engine นับแต้ม
- Security Agent ตรวจพบความผิดปกติ → ยิง `security.anomaly` → Notify Agent แจ้งเตือนด่วน
- Backup Agent ทำงานเสร็จ → ยิง `backup.completed` → Dashboard อัปเดตสถิติ

```ts
export type AgentEventName =
  | "file.imported" | "file.organized" | "file.searched"
  | "security.anomaly" | "security.permission_denied"
  | "ai.summary_ready" | "backup.completed" | "backup.failed";

export interface AgentEvent<T = unknown> {
  name: AgentEventName;
  sourceAgent: AgentCode;
  userId: string;
  payload: T;
  createdAt: string;
}

export interface AgentEventBus {
  publish(event: AgentEvent): Promise<void>;
  subscribe(name: AgentEventName, handler: (e: AgentEvent) => void): () => void;
}
```

ทุก event ที่ publish จะถูก persist ลงตาราง `agent_activity_logs` โดยอัตโนมัติที่ระดับ
`agent-core` (ไม่ใช่หน้าที่ของแต่ละ agent) — นี่คือสิ่งที่ทำให้ Dashboard/Achievement
เป็น generic consumer ของ log แทนที่จะผูกกับ agent ใดเป็นพิเศษ

## 1.5 Cross-cutting: Security Agent เป็น Middleware ไม่ใช่แค่ Agent

Cub Security Agent (RBAC/Activity Log) พิเศษกว่า agent อื่นตรงที่ต้องถูกเรียกจาก
**ทุก** agent ก่อนทำ action ที่มีผลกระทบ (ลบไฟล์, เปลี่ยน permission, restore backup)
จึง implement เป็น middleware ที่ inject เข้า `AgentContext.permissions` แทนที่จะเป็น
optional dependency:

```ts
await ctx.permissions.check(userId, "file:delete", fileId); // throw ถ้าไม่มีสิทธิ์
```

ทุกครั้งที่ check จะถูก log เข้า `security_events` เสมอ (ทั้ง allow และ deny)
