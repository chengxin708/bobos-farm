# Booking Redesign v3 — Implementation Plan

**Date:** 2026-04-20
**Design:** `./2026-04-20-booking-redesign-design.md` (v3 FINAL)
**Scope:** 6 phases, ~40 commits. 每 commit 独立可部署 + 可回滚。

---

## 约定

- **Commit message 前缀**：`feat(booking-redesign):`, `fix(booking-redesign):`, `chore(booking-redesign):`, `refactor(booking-redesign):`, `test(booking-redesign):`
- **每个 commit 独立可部署**——migration 先上（schema 向后兼容），代码后上
- **迁移编号**：`2026042X000NNN_short_description`（按日期+序号）
- **测试**：每个后端 PR 至少加 1 个 jest 测试覆盖新逻辑
- **Feature flag 原则**：不用 runtime flag，用"代码路径只在新 schema 存在时激活"

---

## Phase 1 — Schema & Infrastructure（claim token 基础 + 多包）

**目标**：所有下游功能依赖的基础 schema 就位。

### 1.1 `ReservationClaimToken` model

**Commit**: `feat(booking-redesign): add ReservationClaimToken model`
**Files**:
- `prisma/schema.prisma` — 新 model（见 design §4.2.A）
- `prisma/migrations/20260421000001_add_reservation_claim_tokens/migration.sql`

**内容**:
```prisma
model ReservationClaimToken {
  id                String    @id @default(cuid())
  reservationId     String
  token             String    @unique
  createdAt         DateTime  @default(now())
  expiresAt         DateTime?
  consumedAt        DateTime?
  consumedByUserId  String?
  revokedAt         DateTime?

  reservation Reservation @relation(fields: [reservationId], references: [id], onDelete: Cascade)

  @@index([reservationId])
  @@map("reservation_claim_tokens")
}
```

**Reservation 加反向 relation**：`claimTokens ReservationClaimToken[]`

**验证**: `npx prisma migrate dev`, `npx prisma generate`

---

### 1.2 `User.mergedIntoUserId` 自 FK

**Commit**: `feat(booking-redesign): add User.mergedIntoUserId for soft-merge audit`
**Files**:
- `prisma/schema.prisma`
- `prisma/migrations/20260421000002_user_merged_into/migration.sql`

**内容**:
```prisma
model User {
  // ...existing...
  mergedIntoUserId String?
  mergedInto       User?   @relation("UserMerge", fields: [mergedIntoUserId], references: [id], onDelete: SetNull)
  merges           User[]  @relation("UserMerge")
}
```

---

### 1.3 Order → multi-per-reservation

**Commit**: `feat(booking-redesign): Order.reservationYurtId for multi-package orders`
**Files**:
- `prisma/schema.prisma`
- `prisma/migrations/20260421000003_order_per_package/migration.sql`

**迁移顺序（一个 migration 内）**:
1. `ALTER TABLE orders ADD COLUMN reservation_yurt_id TEXT`  (nullable)
2. 回填：每个 Order 查对应 reservation 的唯一 ReservationYurt 行（之前 `cfa1ecc` 迁移保证每个 reservation 至少一行）
3. `ALTER TABLE orders ALTER COLUMN reservation_yurt_id SET NOT NULL`
4. `ALTER TABLE orders ADD CONSTRAINT orders_reservation_yurt_id_key UNIQUE (reservation_yurt_id)`
5. `ALTER TABLE orders ADD CONSTRAINT orders_reservation_yurt_id_fkey FOREIGN KEY (reservation_yurt_id) REFERENCES reservation_yurts(id) ON DELETE CASCADE`
6. `ALTER TABLE orders DROP CONSTRAINT orders_reservation_id_key`  (去 unique)
7. `CREATE INDEX orders_reservation_id_idx ON orders(reservation_id)`  (普通 index)

**回填 SQL**:
```sql
UPDATE orders o
SET reservation_yurt_id = ry.id
FROM reservation_yurts ry
WHERE ry.reservation_id = o.reservation_id
  AND o.reservation_yurt_id IS NULL;
```

**schema.prisma 改动**:
```prisma
model Order {
  reservationId     String
  reservationYurtId String  @unique
  // ...existing...
  reservationYurt   ReservationYurt @relation(fields: [reservationYurtId], references: [id], onDelete: Cascade)

  @@index([reservationId])  // 替代原 unique
}

model Reservation {
  // ...existing...
  order   Order?    @relation  →  orders Order[]   // 变多对一
}

model ReservationYurt {
  // ...existing...
  order Order?
}
```

**代码跟进**（同 commit 或下一 commit）:
- `useReservationsData.ts`、`ReservationDetail.tsx` 等 `reservation.order` 引用改为 `reservation.orders[0]`（现在保证 1:1，多包在 Phase 2 引入）
- Grep `\.order\b`（作为属性）逐一审查

**回滚预案**: 如果回填失败，回滚这一 migration；`Order.reservationId` 仍 unique 的旧代码不受影响。

---

### 1.4 条件 unique index（yurt+date 防双占）

**Commit**: `feat(booking-redesign): prevent concurrent yurt+date double-hold`
**Files**:
- `prisma/migrations/20260421000004_yurt_date_active_unique/migration.sql`

**内容**:
```sql
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS reservation_yurt_date_active
  ON reservations (yurt_id, date)
  WHERE status NOT IN ('CANCELLED', 'CANCELLED_PENDING_REFUND', 'EXPIRED')
    AND yurt_id IS NOT NULL;
```

**影响范围**: POST /api/reservations 并发创建时，第二个请求会抛 Prisma unique error。需要在 API 层 catch 并转成友好错误。

**代码**: `src/app/api/reservations/route.ts` 在 create reservation 的 try-catch 里加 `P2002` 识别:
```ts
catch (e) {
  if (e.code === 'P2002' && e.meta?.target?.includes('reservation_yurt_date_active')) {
    return NextResponse.json({ error: "This yurt+date is already held" }, { status: 409 });
  }
  throw e;
}
```

---

### 1.5 Token util + historical backfill

**Commit**: `feat(booking-redesign): claim token util and historical backfill`
**Files (new)**:
- `src/lib/claim-token.ts` — `generateToken()`, `createTokenForReservation()`
- `scripts/backfill-claim-tokens.ts` — 一次性脚本
- `src/lib/__tests__/claim-token.test.ts`

**generateToken**:
```ts
import crypto from "crypto";
export function generateClaimToken(): string {
  return crypto.randomBytes(32).toString("base64url");  // 43 chars, 256 bits
}
```

**backfill 脚本逻辑**:
- 查询所有 `holdByAdmin=true AND status IN (PENDING_PAYMENT, PAYMENT_SUBMITTED, CONFIRMED)` 且无现存 token 的 reservation
- 每条生成 token
- 输出进度和总数

**package.json**:
```json
"scripts": {
  "db:backfill-tokens": "npx tsx scripts/backfill-claim-tokens.ts"
}
```

**build 自动化?** **不加** build 脚本——一次性回填，手动跑即可。

---

### 1.6 Claim API 重写（token + merge + transaction）

**Commit**: `feat(booking-redesign): claim API with token validation + account merge`
**Files**:
- `src/app/api/reservations/claim/route.ts` — 全重写
- `src/app/api/reservations/lookup/route.ts` — 接受 token
- `src/lib/__tests__/claim-flow.test.ts` — 新增

**lookup 变更**: GET 接受 `?code=X&t=Y`，两者都传时校验 token（防仅凭 code 窃取预约信息）；只传 code 走"弱路径"（只允许 placeholder 唯一 active reservation）。

**claim POST 核心逻辑**（伪代码见 design §4.2.B）:
- 必要入参: `code`, `token`（弱路径时可缺 token）
- 状态白名单 check: `PENDING_PAYMENT | PAYMENT_SUBMITTED | CONFIRMED`
- Admin 账户阻止: 如果 `session.user.role === "ADMIN"` → 403 `{error: "admin_cannot_claim"}`
- 全程 `prisma.$transaction({..., isolationLevel: "Serializable"})`
- Token 消费条件更新 + `updateMany`
- 迁移: Reservation, UserContactEntry (upsert), Inquiry
- 软删 placeholder + 设 `mergedIntoUserId`
- ActivityLog

**测试**:
- 正常 claim 流
- 并发 claim（两个请求，只一个成功）
- Token 过期 / revoked / consumed → 403
- Admin session → 403
- 状态不在白名单 → 403
- 多 reservation 合并（placeholder 有 3 个预约都迁移）

---

### 1.7 Copy Link 带 token

**Commit**: `feat(booking-redesign): admin copy-link generates tokenized URL`
**Files**:
- `src/components/admin/reservations/ReservationDetail.tsx:419-488` — 复制按钮逻辑
- `src/app/api/reservations/[id]/claim-token/route.ts` — 新增 POST (generate/rotate) + GET (read current)
- `messages/en.json`, `messages/zh.json` — 新增 "revoke_token" 文案

**行为**:
- Detail 页加载时调 GET `/api/reservations/[id]/claim-token` 拿当前有效 token（如无则前端显示"生成链接"按钮调 POST 创建）
- "Copy Link" 使用 `?code=X&t=Y`
- "Copy Message" 模板也嵌入带 token 的 URL
- 新增 "🔄 重新生成链接" 小按钮（一行小字），revoke 旧 token + 生成新 token + 提示 "旧链接已失效"

**测试**: 手动在 admin UI 点击，用无痕窗口访问链接验证 claim 走通。

---

### Phase 1 完成标准
- [ ] Schema migrate 成功（本地 + prod）
- [ ] 所有历史代客单都有 token
- [ ] claim 测试全绿
- [ ] admin UI 复制的链接客户能认领
- [ ] 并发认领只 1 个成功

---

## Phase 2 — Admin 代客改进 + 多包支持

**目标**: admin 侧代客流程的可视化 + 多包创建能力。

### 2.1 接线 `admin_deposit_deadline_hours`

**Commit**: `feat(booking-redesign): wire admin_deposit_deadline_hours for proxy bookings`
**Files**:
- `src/app/api/reservations/route.ts:240-280` (admin branch)
- `src/app/api/cron/expire-reservations/route.ts`
- `src/lib/__tests__/admin-reservation-deadline.test.ts`

**route.ts 改动**:
- 读 setting, 默认 48h
- future + deposit>0 的分支: `paymentDeadline = now + hours`
- past / $0 分支: `paymentDeadline: null`（维持原样）

**cron 改动**:
```ts
await prisma.reservation.updateMany({
  where: {
    status: "PENDING_PAYMENT",
    paymentDeadline: { lt: now },
    holdByAdmin: false,  // 新增：客户自助单才自动过期
  },
  data: { status: "EXPIRED" },
});
```

**测试**: jest 覆盖两条分支（holdByAdmin 自动过期 vs 不过期）。

---

### 2.2 ReservationDetail — 倒计时 + 超期 banner + 无邮箱警示

**Commit**: `feat(booking-redesign): admin proxy detail countdown + overdue banner + no-email warning`
**Files**:
- `src/components/admin/reservations/ReservationDetail.tsx`
- `src/lib/format-deadline.ts` — 新增格式化工具（"48h 剩" / "24h 内" / "已超期 12h"）
- `messages/en.json`, `messages/zh.json`

**UI 位置**（参考现有 layout）:
- status bar 下方新增一行 countdown chip（只在 `holdByAdmin && PENDING_PAYMENT` 显示）
- 如果 placeholder email：countdown chip 下方再加一行黄色警示 banner "此预约客户无邮箱..."（复用 ReservationDetail 已有 toast/banner 样式）

**测试**: Visual only (本阶段不加 E2E)。

---

### 2.3 "延长 24h" 按钮

**Commit**: `feat(booking-redesign): extend-hold button for admin proxy deadlines`
**Files (new)**:
- `src/app/api/reservations/[id]/extend-hold/route.ts` — POST
- `src/components/admin/reservations/ExtendHoldButton.tsx`
- `src/lib/email.ts` — 新增 `sendPaymentDeadlineExtended(to, data)`
- `src/lib/email-strings.ts` — 新 strings
- `src/lib/__tests__/extend-hold.test.ts`

**API 逻辑**:
- 权限: admin only
- 前置: `holdByAdmin=true && status=PENDING_PAYMENT`
- 动作: `paymentDeadline += 24h`
- 邮件: 如果 `!user.email.endsWith('@placeholder.local')` → 发 `sendPaymentDeadlineExtended`
- ActivityLog: `action=HOLD_EXTENDED`, `details={newDeadline, extendedBy: 24h, extendCount: N}`

**UI**:
- 放在现有 "Cancel" / "Release" 按钮组旁
- 乐观更新: 点击后 UI 立即显示新 deadline
- 显示累计次数: "已延长 3 次"
- 次数 ≥3 时旁边小字提示 "超过 3 次考虑直接释放"（不禁用）

---

### 2.4 "释放此预约" 按钮 + cancel API 分支

**Commit**: `feat(booking-redesign): release-hold action distinct from customer cancel`
**Files**:
- `src/app/api/reservations/[id]/route.ts` — PATCH handler 加 isReleaseHold 分支
- `src/components/admin/reservations/ReleaseHoldButton.tsx`
- `src/components/admin/reservations/ReservationDetail.tsx` — 集成按钮
- `messages/en.json`, `messages/zh.json`

**PATCH 改动**:
```ts
if (newStatus === "CANCELLED") {
  const isReleaseHold =
    existing.holdByAdmin &&
    existing.depositStatus === "UNPAID" &&
    existing.status === "PENDING_PAYMENT";

  if (isReleaseHold) {
    // skip email
    cancelReason = body.cancelReason ?? "Admin released unpaid hold";
  } else {
    // 原逻辑: sendReservationCancelled
  }
}
```

**UI**:
- 仅在 `holdByAdmin && UNPAID && PENDING_PAYMENT` 显示 "释放此预约"
- 其他情况仍显示 "取消预约"
- 释放按钮: 二次确认 modal, 文案明确"不发取消邮件""位置立即可用"
- ActivityLog: `action=RESERVATION_RELEASED`

---

### 2.5 List 页 "超期未付代客单" filter

**Commit**: `feat(booking-redesign): overdue admin holds filter in reservations list`
**Files**:
- `src/components/admin/reservations/ReservationsDesktop.tsx` — 加 filter chip
- `src/components/admin/reservations/ReservationsMobile.tsx` — 同上
- `src/components/admin/reservations/useReservationsData.ts` — filter 逻辑

**Filter 条件**: `holdByAdmin=true && status=PENDING_PAYMENT && paymentDeadline < now`

---

### 2.6 CreateReservationModal — 多选 yurt

**Commit**: `feat(booking-redesign): multi-yurt selector for admin proxy bookings`
**Files**:
- `src/components/admin/CreateReservationModal.tsx` — 单选改多选
- `messages/en.json`, `messages/zh.json`

**UI 变化**:
- "分配 Yurt" 下拉 → checkbox list（显示每个 yurt 的容量 + 该日可用性）
- 选择≥1 yurt 显示 "押金: $300 × {N} = ${N*300}"
- `__hold__` 选项作为单独 radio（互斥，不能 + 具体 yurt）
- 至少选一项验证

**表单 state**: `yurtIds: string[]` 替代 `yurtId: string`

---

### 2.7 POST /api/reservations admin 分支 — 创建多个 Order

**Commit**: `feat(booking-redesign): admin multi-yurt reservation creates N orders`
**Files**:
- `src/app/api/reservations/route.ts` — admin branch
- `src/lib/__tests__/multi-yurt-admin.test.ts`

**改动**:
- body schema: `yurtIds: z.array(z.string()).min(1).optional()` + 保留 `yurtId` 单个向后兼容
- 如果 yurtIds 有值且 >1:
  - 所有 yurt 都查 capacity 和冲突
  - `depositAmount = customDeposit ?? 300 * yurtIds.length`
  - 事务内创建 Reservation + N ReservationYurt + N Order (DRAFT, 空 items)
  - Reservation.yurtId 设为 yurtIds[0]（主 yurt，向后兼容）
- 如果单 yurt: 维持原逻辑 + 创建 1 个 Order

**所有新 reservation 都创建 Order**（即使单包）——统一数据模型。

**测试**: 覆盖 1/2/3 yurt，yurt 冲突，容量超限。

---

### 2.8 客户 & admin /reservations/[id] — 渲染 N 个 Order

**Commit**: `feat(booking-redesign): reservation detail renders per-package order tabs`
**Files**:
- `src/app/(customer)/reservations/page.tsx` — 渲染 orders 列表
- `src/components/admin/reservations/ReservationDetail.tsx` — orders section 改 tabs
- `src/components/customer/ReservationDetailContent.tsx` (如存在)

**改动**:
- 顶部 Reservation 信息（日期、总押金、状态、付款截止）
- 下方 "菜单 / Orders" 区域:
  - 单 order: 现状（一个面板）
  - 多 order: Tabs, 每个 tab 一个包的 order（显示 yurt name + capacity）
  - 如果菜单功能此时未上线：tab 内只显示 "尚未开放菜单"

**关键**: 对**单包的老预约**保持体验不变（只一个 tab 不显示 tab 栏）。

---

### Phase 2 完成标准
- [ ] admin 可以创建 1-3 yurt 多包预约
- [ ] 每个包对应一个 Order 行
- [ ] deadline 倒计时 + 超期 banner 正常显示
- [ ] 延长 / 释放按钮功能正常，email 正确触发 / 跳过
- [ ] cron 只过期客户自助单
- [ ] 现有单包流程无回归

---

## Phase 3 — 登录门槛 + Claim 内联注册

**目标**: 预约前必须登录；claim 页无缝注册体验。

### 3.1 `/booking/*` middleware auth

**Commit**: `feat(booking-redesign): require auth for /booking/* routes`
**Files**:
- `src/middleware.ts` — 加 matcher

**改动**: 当前 `middleware.ts` 保护 `/admin/*`。增加 `/booking/*`（除 `/booking/start` 允许未登录显示双卡片？或者也要登录——design 说双卡片本身就是登录后的路径，统一要求登录）。

**结论**: `/booking/*` 全部要求登录；首页 `/` 的 CTA 会引导到登录，再跳 `/booking/start`。

**matcher**:
```ts
export const config = {
  matcher: ["/admin/:path*", "/booking/:path*"],
};
```

---

### 3.2 `callbackUrl` same-origin 校验

**Commit**: `fix(booking-redesign): validate callbackUrl to prevent open redirect`
**Files**:
- `src/app/(auth)/login/page.tsx` — 校验 callbackUrl
- `src/lib/safe-callback.ts` — 新增 util
- `src/lib/__tests__/safe-callback.test.ts`

**util**:
```ts
export function safeCallbackUrl(raw: string | null | undefined, origin: string): string {
  if (!raw) return "/reservations";
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) return "/reservations";
    const allowlist = ["/booking", "/claim", "/reservations", "/inquiries"];
    if (!allowlist.some(p => url.pathname === p || url.pathname.startsWith(p + "/"))) {
      return "/reservations";
    }
    return url.pathname + url.search;
  } catch {
    return "/reservations";
  }
}
```

---

### 3.3 `/claim` 页内联登录/注册 tabs

**Commit**: `feat(booking-redesign): inline login/register on /claim with full registration fields`
**Files**:
- `src/app/(customer)/claim/page.tsx` — 重构加 tabs
- `src/app/api/reservations/claim/route.ts` — 支持 register+claim 组合
- `messages/en.json`, `messages/zh.json`

**UI 结构**:
- 未登录：
  - 顶部: 预约摘要（date, guest count, deposit）
  - Tabs: "登录" (默认) | "注册"
  - 登录 tab: email+密码+Google OAuth
  - 注册 tab: **完整字段**（email, password, name, phone, preferredLanguage, marketingOptIn）
  - 两个 tab 的 submit 都**自动触发 claim**（session 建立 + claim 在同一网络请求链）
- 已登录且非 admin：显示 "认领此预约" 按钮
- 已登录 admin：显示错误 "Admin 账户无法认领客户预约"

**注册 + 自动 claim 流程**:
1. 前端提交 register + claim 一起（两个相继的 fetch，共享 onError）
2. 或者改 `/api/auth/register` 接受 `{claimCode, claimToken}` 可选参数，服务端注册后内部调用 claim 逻辑（更原子）——**选这个**

**注册 API 扩展** `src/app/api/auth/register/route.ts`:
- 参数里加可选 `claimCode`, `claimToken`
- 注册成功后，如果两者都有：服务端内部调 claim 逻辑（复用 §1.6 的 transaction），返回合并结果

---

### 3.4 OAuth 取消 fallback + rate limit

**Commit**: `feat(booking-redesign): oauth cancel fallback + rate limits on auth endpoints`
**Files**:
- `src/app/(auth)/login/page.tsx` — 识别 `?error=access_denied` 自动切 email tab，保留 callbackUrl
- `src/lib/rate-limit.ts` — 新增（可用 LRU 简易内存限流）
- `src/app/api/auth/register/route.ts` — 每 IP 5/hr
- `src/app/api/reservations/claim/route.ts` — 每 IP 10/hr

**rate limiter**: 小业务规模不需 Redis，用 `lru-cache` 内存缓存即可。单实例 Vercel OK。

---

### Phase 3 完成标准
- [ ] 未登录访问 `/booking/*` → 跳 login
- [ ] `callbackUrl=//evil` 不生效
- [ ] Claim 页内联注册 → 一键完成账户 + claim
- [ ] Admin 账户访问 claim 链接被拒
- [ ] Rate limit 触发 429

---

## Phase 4 — Inquiry 系统

**目标**: 咨询单全流程（客户端提交 → admin 跟进 → 转 reservation）。

### 4.1 POST /api/inquiries + 自动打标签

**Commit**: `feat(booking-redesign): inquiry submission API with auto-tagging`
**Files (new)**:
- `src/app/api/inquiries/route.ts` — GET (admin), POST (customer)
- `src/lib/inquiry-tagging.ts` — 标签生成逻辑
- `src/lib/__tests__/inquiry-tagging.test.ts`

**Tagging 逻辑**（读 4 个 settings）:
```ts
async function computeTags(data: InquiryInput, userId: string): Promise<{tags: string[], priority: InquiryPriority}> {
  const settings = await getSettings([
    "inquiry_big_order_threshold",
    "inquiry_full_booking_threshold",
    "inquiry_urgent_days",
    "inquiry_vip_confirmed_count",
  ]);
  const tags: string[] = [];
  let priority: InquiryPriority = "NORMAL";

  if (data.guestCountMax >= settings.inquiry_big_order_threshold) tags.push("big_order");
  if (data.guestCountMax >= settings.inquiry_full_booking_threshold) tags.push("full_booking");

  const daysToDate = differenceInDays(data.preferredDate, new Date());
  if (daysToDate <= settings.inquiry_urgent_days) {
    tags.push("urgent");
    priority = "URGENT";
  }

  // VIP: 只计 post-claim 的 CONFIRMED/COMPLETED
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const confirmedCount = await prisma.reservation.count({
    where: {
      userId,
      status: { in: ["CONFIRMED", "COMPLETED"] },
      createdAt: { gte: user.createdAt },  // 防止 pre-claim placeholder 历史计入
    },
  });
  if (confirmedCount >= settings.inquiry_vip_confirmed_count) tags.push("vip");

  return { tags, priority };
}
```

---

### 4.2 Inquiry admin API

**Commit**: `feat(booking-redesign): admin inquiry list + detail + comment APIs`
**Files (new)**:
- `src/app/api/inquiries/[id]/route.ts` — GET, PATCH
- `src/app/api/inquiries/[id]/comments/route.ts` — POST
- `src/app/api/inquiries/[id]/convert/route.ts` — POST（转为 reservation）

**convert 逻辑**:
- 复用 §2.7 的多 yurt reservation creation
- 参数: `yurtIds`, `guestCount`（最终确定人数）, `date`（允许调整）
- 创建后: `Inquiry.reservationId = new.id`, `status=CONVERTED`, `convertedAt=now()`
- 生成 claim token (虽然客户已登录，admin 可能要复制链接发)

---

### 4.3 客户端 Inquiry 提交表单

**Commit**: `feat(booking-redesign): customer inquiry submission form`
**Files (new)**:
- `src/app/(customer)/inquiries/new/page.tsx`
- `src/app/(customer)/inquiries/[id]/submitted/page.tsx`  — 确认页
- `messages/en.json`, `messages/zh.json` — inquiry 相关 copy

**预填逻辑**: URL param `?guestCount=N&date=YYYY-MM-DD` (从 `/booking/details` 超 30 人弹窗跳转时带)

---

### 4.4 客户端我的咨询列表（轻量）

**Commit**: `feat(booking-redesign): customer inquiry list page`
**Files (new)**:
- `src/app/(customer)/inquiries/page.tsx`
- `src/app/api/inquiries/mine/route.ts`

**简单列表**: status, preferredDate, guestCount range, 最后更新时间, "查看详情" 链接。
`CONVERTED` 状态的带 "→ 查看预约" 快捷链接。

---

### 4.5 Admin Inquiry UI

**Commit**: `feat(booking-redesign): admin inquiry list + detail pages`
**Files (new)**:
- `src/app/(admin)/admin/inquiries/page.tsx` — 列表
- `src/app/(admin)/admin/inquiries/[id]/page.tsx` — 详情
- `src/components/admin/inquiries/InquiryList.tsx`
- `src/components/admin/inquiries/InquiryDetail.tsx`
- `src/components/admin/inquiries/ConvertToReservationModal.tsx`

**列表默认排序**: `priority desc, status asc (PENDING first), createdAt desc`。
**筛选**: status, priority, tag, assignedAdminId, 日期范围。
**徽章**: 每个 tag 用不同颜色（复用 `Tag` model 的 color）。

---

### 4.6 Inquiry cron jobs

**Commit**: `feat(booking-redesign): inquiry timeout + auto-expire cron jobs`
**Files (new)**:
- `src/app/api/cron/inquiry-timeouts/route.ts` — PENDING 超时 warn/escalate
- `src/app/api/cron/inquiry-auto-expire/route.ts` — AWAITING_CUSTOMER 7d 过期
- `vercel.json` — 加 cron schedule（UTC 00:00 每日）

**Timeout 逻辑**（防重发）:
- 用 `ActivityLog` 作为去重：查该 inquiry 是否已有 `INQUIRY_UNCLAIMED_24H` → 有则跳过 warn；同理 48H escalate

---

### Phase 4 完成标准
- [ ] 客户可以提交 inquiry
- [ ] 标签自动打对
- [ ] Admin 能看到列表、详情、添加评论、转预约
- [ ] cron 按 settings 阈值工作
- [ ] 转预约后客户端 `/reservations` 能看到

---

## Phase 5 — 前端入口

**目标**: 客户首次预约从 `/booking/start` 进入，自助流加 >30 拦截。

### 5.1 `/booking/start` 双卡片

**Commit**: `feat(booking-redesign): booking start page with dual-path selection`
**Files (new)**:
- `src/app/(customer)/booking/start/page.tsx`
- `messages/en.json`, `messages/zh.json`

**UI**（design §2.2）: 两卡片 desktop 并列，mobile stack + "或"分隔。
链接: "我已确定" → `/booking/date`; "我还不确定" → `/inquiries/new`.

---

### 5.2 `/booking/details` 超 30 人拦截

**Commit**: `feat(booking-redesign): gate >30 guest count in self-serve flow`
**Files**:
- `src/app/(customer)/booking/details/page.tsx` — 加 modal
- `messages/en.json`, `messages/zh.json`

**逻辑**: onSubmit / onNext 时 `guestCount > 30` → 弹 modal → 两个按钮 "转为咨询" / "修改人数"
- 转咨询: 跳 `/inquiries/new?guestCount=${guestCount}&date=${selectedDate}&email=${contactEmail}&phone=${contactPhone}`
- 修改人数: 关闭 modal，回到填人数输入

---

### 5.3 首页 CTA 调整

**Commit**: `feat(booking-redesign): homepage CTA routes through /booking/start`
**Files**:
- `src/app/(customer)/page.tsx` — "开始预约" 按钮改跳 `/booking/start`（未登录会被 middleware 跳登录）

---

### Phase 5 完成标准
- [ ] 未登录用户点首页预约按钮 → 登录页 → `/booking/start`
- [ ] >30 人正确跳到 inquiry 表单（预填）

---

## Phase 6 — GDPR 数据删除脚本

**Commit**: `feat(booking-redesign): admin data deletion script (GDPR)`
**Files (new)**:
- `scripts/delete-user-data.ts`

**流程**: design §8。交互式 CLI:
```bash
npx tsx scripts/delete-user-data.ts --user-id=USER_ID --confirm
```

**输出**: 删除清单 (几条 UserContactEntry, Account, PushSubscription) + 匿名化确认 + activity log 写入。

---

## 测试策略

### 关键集成测试（建议至少覆盖）
- Claim with valid token → merge → placeholder soft-deleted
- Claim without token → only works if single active reservation on placeholder
- Concurrent claim → one succeeds, one 409
- Admin multi-yurt create → N orders, deposit = 300×N
- Admin extend-hold → deadline += 24h, email sent iff real email
- Admin release-hold → status=CANCELLED, no email, activity log
- Cron expire-reservations → only holdByAdmin=false auto-expired
- >30 guest self-serve → modal blocks, links to inquiry with prefill
- Inquiry submit → correct tags based on threshold/date/VIP status
- Inquiry convert → multi-yurt reservation with token

### 手动回归清单（每 Phase 结束后）
- [ ] 现有客户自助流（单包 ≤30）能完整走完
- [ ] 现有 claim 流（老链接）兼容
- [ ] admin 单 yurt 代客流程不受影响
- [ ] 现有菜单功能（如菜单页）不被 N orders 影响

---

## 回滚策略

每个 phase 的 commit 独立可回滚。关键 migration 回滚：
- 1.3 (`Order` multi-per-reservation): 只要确保 app 代码里没有 `reservation.orders.length > 1` 的依赖，就可以回滚——但一旦创建过多包预约，回滚会丢数据。建议 phase 2 上线前确认 phase 1 稳定。

---

## 进度跟踪

建议每完成一个 commit 就 push + 让 Vercel 部署 + 在 staging 快速验证，再开下一个。
Phase 之间需要用户 sign-off。
