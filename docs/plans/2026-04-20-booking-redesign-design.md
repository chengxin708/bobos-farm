# Booking Redesign v3 — Design Doc

**Date:** 2026-04-20
**Status:** FINAL DRAFT（已融合 3 份审核 + 用户 Q1-Q7 决策）
**Supersedes:**
- v1 (M2-M6 里程碑式拆分) — 理解错误作废
- v2 (包客户可见) — Q1 决策后**包改为内部概念**，重写

---

## 0. 关键前提（Q1 简化后）

**核心认知**：包（16/25/30）是**admin 内部分配工具**，客户**完全不感知**。
- 客户只填**人数**（≤30）
- 押金固定 **$300**（所有包、所有人数都一样）
- **到店前 7 天**锁定时，admin 在邮件/平台告知 "您被分配到 Room 2，24 人包"
- 包数量字段 `packageCount` 只在 inquiry 多包和 admin 侧显示

**这意味着**：
- ❌ 不需要"包卡片"、"包价格"、"包选择"屏
- ❌ 不需要包的 pricing tier
- ✅ 现有 `/booking/date → /booking/details → /booking/confirm` 客户端流程**保留**，只加登录门槛和 >30 分支

---

## 1. 指导原则

1. 中间（选日期 / 付押金 / 确认）不动——客户自助订单核心 OK
2. 不自动触达客户——所有客户通信由 admin 用自己手机粘贴发送（iMessage/WeChat）
3. Admin 主导——代客单不自动过期；系统给 admin 更好的可视化和提醒
4. 已有能用就不重写——claim 链接复制、消息模板、语言切换都保留，只做增量改进

---

## 2. 前端：客户预约入口

### 2.1 必须登录
- `/booking/*` 所有路由加 **middleware auth guard**（不再靠客户端 `useSession`）
- 未登录 → `/login?callbackUrl=...`
- **`callbackUrl` 必须 same-origin 校验 + 路径白名单**（`/booking/*`, `/claim`, `/reservations`）——防开放重定向
- 邮箱验证**不强制**（`require_email_verification` 保留 setting，默认 `false`）

### 2.2 入口双卡片（`/booking/start`）

**双卡片的本质是数据模型的分叉**：
- 左卡片 → 客户可以给出**一个确定数字**（走 Reservation，`guestCount: Int`）
- 右卡片 → 客户只能给出**一个范围**（走 Inquiry，`guestCountMin/Max: Int`）

"不确定" ≠ 完全不知道，而是指**无法给出单一固定值**（能说"大约 15-20 人"就算不确定）。

```
┌─────────────────────────────┐  ┌─────────────────────────────┐
│ ✅ 我已确定具体人数           │  │ 💬 我还不确定具体人数          │
│ 比如"18 人"这样的明确数字     │  │ 比如"15-20 人"这样的范围       │
│ 立即锁位，$300 押金           │  │ 无需押金，工作人员协助确定      │
│ [ 开始预约 ]                 │  │ [ 提交咨询 ]                  │
└─────────────────────────────┘  └─────────────────────────────┘
```

**移动端**：竖向 stack（卡片之间加 "或" 分隔）。
**状态持久化**：选择后跳目标页，不需保存 `/booking/start` 的状态。
**不强制进入**：已登录用户直接访问 `/booking/date` 也允许（老用户习惯路径不变）。

### 2.3 自助路径（人数 ≤30）

**流程不变**：`/booking/date → /booking/details → /booking/confirm`

**唯一改动：`/booking/details` 的人数输入加 >30 拦截**
- 输入 **≤30** → 正常继续
- 输入 **≥31** → **弹出模态框**（不允许关闭继续）：
  > "您的团体规模（N 人）超出自助预约上限。
  > 这类活动通常需要工作人员协助安排多个包间，
  > 请提交咨询单，我们在 24–48 小时内联系您。
  >
  > [转为咨询 →]    [修改人数]"

- `>30` 的"修改人数"按钮关闭模态框，保留当前已填信息
- `>30` 的"转为咨询"按钮跳 `/inquiries/new`，**预填**当前 guestCount (作为 guestCountMax) + date + 联系方式
- `= 30` 不触发拦截（≤30 范围内）

**`max_guest_count` 设置**：客户端 input 的 `max` 属性仍然来自 setting（现状）；但 >30 的硬拦截在提交/下一步时检查（不只靠 input max）。

### 2.4 咨询单路径

客户端表单 `/inquiries/new`：

| 字段 | 必填 | 说明 |
|---|---|---|
| `preferredDate` | ✅ | 单日期选择（未来 7 天以内显示 "紧急" 提示，不阻止） |
| `guestCountMin` | ✅ | 正整数 |
| `guestCountMax` | ✅ | 正整数 ≥ min |
| `packageHint` | ❌ | "不确定 / 16 / 25 / 30 / 55+" 下拉（admin 参考用，客户不用管包对应什么） |
| `notes` | ❌ | textarea，≤2000 字 |
| `contactEmail` | ✅ | 自动带出账户 email，可改 |
| `contactPhone` | ❌ | 自动带出，可改 |

**客户端验证**：
- `min ≤ max`
- `preferredDate ≥ today`
- `guestCountMax` 无上限（55+ 也允许，触发 `full_booking` 标签）

**提交后跳 `/inquiries/[id]/submitted`**（确认页）：
> "✅ 咨询已提交
> 单号：INQ-xxxxx
> 我们会在 24–48 小时内联系您（通过您留下的邮箱 / 微信 / 电话）。
> 到时会根据您的人数、日期建议合适的包间方案。
>
> [查看我的咨询] [返回首页]"

**业务规则**：
- 不占日期（写 `inquiries` 表，不写 `reservations`/`yurt_availability`）
- 不收押金
- 状态机：`PENDING → IN_PROGRESS → AWAITING_CUSTOMER → CONVERTED / CLOSED / EXPIRED`

**自动打标签**（提交时写入 `Inquiry.tags`）：
- `guestCountMax >= inquiry_big_order_threshold (30)` → `big_order`
- `guestCountMax >= inquiry_full_booking_threshold (55)` → `full_booking`
- `preferredDate - now <= inquiry_urgent_days (7)` → `urgent`，同时 `priority = URGENT`
- 该 user 历史 **post-claim** 的 `CONFIRMED`+`COMPLETED` 预约数 ≥ `inquiry_vip_confirmed_count (3)` → `vip`
  - **注意**：必须排除 `pre-claim` 时期 placeholder 账户的历史（防止首次 claim 带 N 个单就被标 VIP）
  - 判定：`reservation.createdAt >= user.emailVerified` 或 `user.createdAt`（以晚者为准，或简单 `createdAt >= user.createdAt` 即可——新用户首次注册时）

**自动超时 / 过期**（cron 每日 UTC 00:00）：
- `PENDING > inquiry_timeout_warn_hours (24h)` → admin push + activity log `INQUIRY_UNCLAIMED_24H`
- `PENDING > inquiry_timeout_escalate_hours (48h)` → priority 升级 + admin push `INQUIRY_UNCLAIMED_48H`
- `AWAITING_CUSTOMER > inquiry_auto_expire_days (7d)` → `status=EXPIRED`，activity log

### 2.5 Inquiry 转 Reservation

Admin 在 `/admin/inquiries/[id]` 点"转为预约"：
- 弹窗确认：日期、最终人数、**分配哪些 yurt（多选）**
- 后台逻辑见 §3.4（多包预约统一流程）
- `Inquiry.reservationId = new.id`, `status=CONVERTED`
- 生成 `ReservationClaimToken`（即使 user 已登录也生成，admin 可复制链接发）

**场景**：客户不是 placeholder（提交 inquiry 时已登录），**不走 placeholder 合并**，直接 `reservation.userId = inquiry.userId`。

---

## 3. 后端：Admin 代客预约

### 3.1 现状痛点（code 扒出来）

| # | 问题 | 位置 |
|---|---|---|
| 1 | `paymentDeadline = null`，永不过期 | `route.ts:274` |
| 2 | `admin_deposit_deadline_hours` 已 seed 但未接线 | — |
| 3 | cron 靠 `paymentDeadline < now` 工作，holdByAdmin 过滤是**副作用**（NULL 自然跳过）——脆弱 | `cron/expire-reservations:34-37` |
| 4 | 没有"延长 / 释放"一键操作 | ReservationDetail.tsx |
| 5 | 没有"未付超期"可视化 | admin 列表 |
| 6 | placeholder 无 email → 不发 `sendReservationCreated` → admin 不知道要线下告知 | `route.ts:301-310` |

### 3.2 变更设计

#### A. 软 deadline（决定：D2）
- 代客单创建时：`paymentDeadline = now + admin_deposit_deadline_hours` (默认 48h)
- **cron 显式过滤 `holdByAdmin=false`**（不再依赖 NULL 副作用）
- 代客单超期**不自动 EXPIRED**，只在 admin 侧"已超期"视觉标记

```ts
// cron/expire-reservations/route.ts
const expired = await prisma.reservation.updateMany({
  where: {
    status: "PENDING_PAYMENT",
    paymentDeadline: { lt: now },
    holdByAdmin: false,  // 显式：客户自助单才自动过期
  },
  data: { status: "EXPIRED" },
});
```

#### B. 超期可视化

**列表（desktop & mobile）**：代客单状态 chip 旁加小徽章
- deadline 未到：无徽章
- 24h 内：`⏱ 24h`（黄）
- 已超期：`⚠️ 超 Nh`（红）

**移动端空间限制**：徽章只在超期时显示（24h 内的提醒靠 detail 页），不挤占列表空间。

**detail 页**：status bar 下一行明显倒计时或超期 banner（红色）："此代客单已超期 12h 未付，请联系客户或释放位置"

**列表筛选**：新增 filter 选项 "超期未付代客单"。

#### C. 延长 / 释放按钮（detail 页）

**"延长 24h" 按钮**（`holdByAdmin=true && status=PENDING_PAYMENT` 时启用）：
- 每次点击 → `paymentDeadline += 24h`
- 写 `ActivityLog(action='HOLD_EXTENDED', details={newDeadline, extendBy: 24})`
- **如果 user 有真 email** → 发一封邮件 "您的预约付款截止已延长 24 小时"（复用 `sendPaymentDeadlineExtended`，新增）
- **如果 user 是 placeholder** → 不发邮件，detail 页提示 "客户无邮箱，请手动通知"
- **无次数上限**（决定：Q4）——但 detail 页累计显示 "已延长 3 次"，超过 3 次时按钮旁小字提示 "考虑直接释放"
- 乐观更新：点击后 UI 立即更新倒计时

**"释放此预约" 按钮**（只在 `holdByAdmin=true && depositStatus=UNPAID && status=PENDING_PAYMENT` 时启用）：
- 二次确认 modal：
  > "释放此代客单？
  > 该位置将立即可被其他客户预订。
  > 客户未付押金，此操作**不发送**取消邮件。
  > [取消] [确认释放]"
- 执行：`status=CANCELLED`, `cancelReason="Admin released unpaid hold"`, `cancelledAt=now`, `refundEligible=false`
- activity log: `RESERVATION_RELEASED`
- **不触发** `sendReservationCancelled`（见 §3.2.E 分支逻辑）

#### D. 释放 vs 取消：UI 区分（基于现有字段）

**研究现状**：
- 状态机（`reservation-fsm.ts`）已有 `PENDING_PAYMENT → CANCELLED` 转换
- `cancelReason: String?` 是 freeform，已用于客户取消原因
- `sendReservationCancelled` 无条件发——**需要加分支**

**UI 策略**：
- **"释放此预约"按钮** — 只在 hold + unpaid 时显示（文字和语义都面向"没付钱的代客单"）
- **"取消预约"按钮** — 现有的取消按钮，所有其他情况
- **后端 PATCH 逻辑**：
  ```ts
  // src/app/api/reservations/[id]/route.ts
  if (newStatus === "CANCELLED") {
    const isReleaseHold = existing.holdByAdmin
                       && existing.depositStatus === "UNPAID"
                       && existing.status === "PENDING_PAYMENT";
    if (isReleaseHold) {
      // 跳过 cancellation email
      // skip refund flow
      cancelReason = cancelReason ?? "Admin released unpaid hold";
    } else {
      await sendReservationCancelled(...);  // 现有逻辑
    }
  }
  ```

**好处**：不加新 enum、不改 schema、不改 FSM，全靠业务规则判断。`cancelReason` 保持 freeform，admin 查看时能看到具体原因（包括"Admin released unpaid hold"）。

#### E. "无邮箱" 警示（detail 顶部）

- 当 `user.email.endsWith('@placeholder.local')`：detail 页 status bar 下显示**黄色警示条**：
  > "⚠️ 此预约客户无邮箱，所有通知须通过微信 / SMS 手动发送。"
  > `[ 📋 复制信息链接 ] [ 📋 复制完整文案 ]`
- 按钮复用现有的 Copy Link / Copy Message 功能
- 警示条位置：在 ReservationDetail.tsx 的 status-bar flex 下，所有 tab 上方，所有分辨率都显示（不折叠）

#### F. 接线 `admin_deposit_deadline_hours`

```ts
// src/app/api/reservations/route.ts admin branch
const setting = await prisma.systemSetting.findUnique({
  where: { key: "admin_deposit_deadline_hours" }
});
const hours = parseInt(setting?.value ?? "48", 10);
paymentDeadline = new Date(Date.now() + hours * 3600 * 1000);
```

### 3.4 多包预约（admin 代客 & Inquiry 转预约共用流程）

**核心认知**：一个 Reservation 是**支付/hold 单位**，但每个包**自己的菜单独立**。

```
Reservation (1)
├── paymentDeadline (1)
├── depositAmount = $300 × N （一次收齐）
├── ReservationYurt[N]  （每个包一行，已有 link 表）
└── Order[N]  （每个包一份菜单，schema 需改）
```

**Schema 改动**（§5 里列了）：
- `Order.reservationId` 去掉 `@unique`，加 `@@index`
- `Order.reservationYurtId: String @unique` 新字段（每个 ReservationYurt 行绑定一个 Order）
- 迁移：为所有历史 Order 回填 `reservationYurtId`（对应该 reservation 唯一的 ReservationYurt 行）

**创建时的行为**（admin 代客 POST / Inquiry 转换）：

```ts
// pseudo-code, 全在一个 $transaction 内
const reservation = await tx.reservation.create({
  data: {
    userId, date, guestCount,
    depositAmount: 300 * yurtIds.length,
    paymentDeadline: now + adminDeadlineHours,
    holdByAdmin: true,
    status: "PENDING_PAYMENT",
    yurtId: yurtIds[0],  // 保留作为"主 yurt"向后兼容
  }
});

for (const [i, yurtId] of yurtIds.entries()) {
  const rYurt = await tx.reservationYurt.create({
    data: { reservationId: reservation.id, yurtId, sortOrder: i }
  });
  await tx.order.create({
    data: {
      reservationId: reservation.id,
      reservationYurtId: rYurt.id,
      status: "DRAFT",
      // menuDeadlineAt 在 CONFIRMED 时由另一流程回填（下一轮）
    }
  });
}

// 生成 claim token
await tx.reservationClaimToken.create({ ... });
```

**admin UI（`CreateReservationModal`）改动**：
- "分配 Yurt" 下拉改为**多选**（checkbox list，显示每个 yurt 的容量 + 当天可用性）
- 选择后自动显示 "押金：$300 × N = $900"
- 可选单个或多个，至少 1 个
- `yurtId === '__hold__'` 保留（无分配 hold，`yurtIds = []`，0 个 ReservationYurt / Order，deposit = $300 占位）

**customer 视角**（`/reservations/[id]`）：
- 头部：Reservation 信息（日期、总押金、状态、付款截止）
- Tabs：Room 1 菜单 / Room 2 菜单 / Room 3 菜单（根据 N 个 Order 生成）
- 每个 tab 里是该包的 OrderItem 管理（独立 menu、独立 `menuDeadlineAt`——下一轮菜单锁定时用）

**admin 视角**（`ReservationDetail`）：
- 现有布局保留
- "订单 / Orders" tab 下显示 **N 个子面板**（以包分组）
- "释放" / "延长" 针对**整个 Reservation**（统一的 hold 单位）——不按包单独操作

**客户自助流程不变**：
- `/booking/*` 自助始终单包（guestCount ≤30，只占 1 yurt，1 order）
- 多包永远只能通过 (a) admin 代客 或 (b) Inquiry 转换

---

### 3.3 并发 / 竞态

**双 admin 同时 hold 同一 yurt+date**：
- 现有唯一性是靠 POST 时查 existing reservation；两个并发请求都能过
- **新增 DB 唯一约束**：
  ```prisma
  // 只能通过 raw migration 实现条件 unique：
  CREATE UNIQUE INDEX reservation_yurt_date_active
    ON reservations (yurtId, date)
    WHERE status NOT IN ('CANCELLED', 'CANCELLED_PENDING_REFUND', 'EXPIRED')
      AND yurtId IS NOT NULL;
  ```
- 第二个 admin 的请求 → 500 unique error → 前端捕获后提示 "已被其他管理员占用"

---

## 4. 后端：Claim（认领）流程

### 4.1 现状（已做的保留）
- ✅ Copy Link / Copy Message / SMS / Email 四种分享
- ✅ 中英双语预填文案（语言选择 modal）
- ✅ Email claim invitation（Resend）
- ✅ `/claim` 页 lookup API 显示预约信息
- ✅ Activity log `RESERVATION_CLAIMED`

### 4.2 增量改进

#### A. Token 安全

**新 model `ReservationClaimToken`**：
```prisma
model ReservationClaimToken {
  id                String    @id @default(cuid())
  reservationId     String
  token             String    @unique
  createdAt         DateTime  @default(now())
  expiresAt         DateTime?
  consumedAt        DateTime?
  consumedByUserId  String?
  revokedAt         DateTime?  // admin 可主动 revoke

  reservation Reservation @relation(fields: [reservationId], references: [id], onDelete: Cascade)

  @@index([reservationId])
  @@index([token])
  @@map("reservation_claim_tokens")
}
```

**Token 生成**：
- `crypto.randomBytes(32).toString('base64url')` → 43 字符，**256 bits 熵**
- 代客单创建时自动生成（`expiresAt = null` 永久，除非 revoke）
- 客户自助单创建**不生成 token**（无需 claim）
- Inquiry 转 reservation 也生成 token

**Backfill**：迁移脚本为历史所有 `holdByAdmin=true` 且状态非终结的 reservation 生成 token。

**URL 格式**：`https://bobos.farm/claim?code=XXXXXX&t=<base64url>`
**向后兼容**：旧 `?code=` URL 仍可 claim，但走"弱路径"——只允许该 placeholder 的唯一 active reservation 被 claim，超过 1 个 active 就要求 token。

**Token 撤销**：admin UI 加"重新生成 claim 链接"按钮 → 把当前 token `revokedAt=now`，生成新 token。

#### B. 账户合并（Claim 后）

**清晰定义合并范围**（解决两个 agent 的歧义）：

| 实体 | 动作 | 理由 |
|---|---|---|
| `Reservation.userId` | **迁移** → realUser | placeholder 所有预约都归该客户 |
| `UserContactEntry.userId` | **迁移** + 去重 | 联系方式历史 |
| `Inquiry.userId` | **迁移** | 同理 |
| `InquiryComment.authorId` | **如果 placeholder 作为作者**（几乎不会发生，placeholder 无法发评论）→ 迁移；admin 写的评论**不变** | |
| `ReservationNote.userId` | **不迁移** | ReservationNote.userId 是**作者**（admin），不是所有权 |
| `ActivityLog.userId` | **不迁移** | 历史事实不可改 |
| `PushSubscription.userId` | **删除** | placeholder 不会 subscribe push |
| `Account.userId` (NextAuth) | **不迁移** | placeholder 无 OAuth |

**合并事务**（全部原子，失败整体回滚）：
```ts
await prisma.$transaction(async (tx) => {
  // 1. 消费 token（原子性，使用条件 update）
  const consume = await tx.reservationClaimToken.updateMany({
    where: { token: input.token, consumedAt: null, revokedAt: null },
    data: { consumedAt: now, consumedByUserId: realUser.id },
  });
  if (consume.count !== 1) throw new Error("Token invalid or already used");

  // 2. 迁移 reservations
  await tx.reservation.updateMany({
    where: { userId: placeholderId },
    data: { userId: realUser.id },
  });

  // 3. 迁移 contact entries（去重）
  const placeholderEntries = await tx.userContactEntry.findMany({ where: { userId: placeholderId } });
  for (const e of placeholderEntries) {
    await tx.userContactEntry.upsert({
      where: { userId_type_value: { userId: realUser.id, type: e.type, value: e.value } },
      update: {},
      create: { userId: realUser.id, type: e.type, value: e.value, source: e.source, recordedById: e.recordedById },
    });
  }
  await tx.userContactEntry.deleteMany({ where: { userId: placeholderId } });

  // 4. 迁移 inquiries
  await tx.inquiry.updateMany({
    where: { userId: placeholderId },
    data: { userId: realUser.id },
  });

  // 5. 软删 placeholder
  await tx.user.update({
    where: { id: placeholderId },
    data: {
      email: `merged-${placeholderId}@deleted.local`,
      mergedIntoUserId: realUser.id,
      name: null, phone: null, wechatId: null,
    },
  });

  // 6. 删 placeholder 的 push subscriptions（防御，应该为空）
  await tx.pushSubscription.deleteMany({ where: { userId: placeholderId } });

  // 7. activity log
  await tx.activityLog.create({
    data: {
      userId: realUser.id,
      action: "ACCOUNT_MERGED",
      targetType: "USER",
      targetId: placeholderId,
      details: { mergedReservationIds: [...], mergedInquiryIds: [...], placeholderEmail: original }
    }
  });
}, { isolationLevel: "Serializable" });
```

**新 schema 字段**：`User.mergedIntoUserId String?`（self-FK，onDelete: SetNull）

#### C. 内联登录 / 注册 + 自动 claim

**`/claim?code=...&t=...` 页面结构**：
- 未登录：
  - 显示预约摘要（date, guest count, deposit amount）
  - tabs: **"登录"** (默认) | **"注册"**
  - "登录" tab：email + password + Google OAuth
  - "注册" tab：**完整字段**（决定：Q6）—— email + password + name + phone + language + marketing opt-in
  - 提交后**自动调用 claim API**（同一 user session）
- 已登录：直接显示"立即认领"按钮

**跳转**：claim 成功 → 跳 `/reservations/[id]`（预约详情）

**成功页提示**：
- Toast: "✅ 已认领成功"
- 如果同时合并了 **≥2 个预约**：显示 banner "已将 N 个预约关联到您的账户"，下面列出预约号和日期
- N=1 不显示 banner（避免噪音）

**未登录状态的 BookingContext**：claim 页在独立 context，不依赖 BookingContext，无丢失风险。

#### D. 可 Claim 状态白名单

只允许 claim 如下状态的 reservation：
- `PENDING_PAYMENT`
- `PAYMENT_SUBMITTED`
- `CONFIRMED`

拒绝：`COMPLETED`, `CANCELLED`, `CANCELLED_PENDING_REFUND`, `EXPIRED`
（past COMPLETED 若要关联历史，走 admin "link to customer" 另一个入口，v3 不做）

#### E. 通知 admin

Claim 成功 → web push 给所有 admin（复用 `sendPushToAdmins`），不发邮件。
消息示例："客户 {name} 已认领预约 #{code}（{date}）"。

### 4.3 Token 生命周期边界情况

| 场景 | 处理 |
|---|---|
| Token 消费中事务失败 | 整个 transaction 回滚，token **保持 consumedAt=null**，可重试 |
| Token 过期（`expiresAt < now`） | 拒绝 claim，UI 提示 "此链接已失效，请联系工作人员重新发送" |
| Token 已撤销（revokedAt 非 null） | 同上 |
| 并发 claim | 步骤 1 的 `updateMany WHERE consumedAt IS NULL` 仅一个会 affect 1 row，另一个 affects 0 → 抛错 |
| Admin 误发给错人 | admin 点 "revoke token" → 生成新 token → 重新复制发送 |

---

## 5. Schema 变更

**新 model**：
- `ReservationClaimToken`（§4.2.A）

**新字段**：
- `User.mergedIntoUserId: String?`（self-FK）
- `Order.reservationYurtId: String @unique` + FK 到 `ReservationYurt.id`（§3.4 多包）

**改动字段**：
- `Order.reservationId: String` ← **去掉 `@unique`**，改为普通 FK + `@@index([reservationId])`
- 这样一个 Reservation 可以有多个 Order（每个包一份菜单）

**不加新 enum**：
- `ReservationStatus` 不加 `RELEASED`（用 CANCELLED + cancelReason + 业务判断）
- `cancelReason` 保持 freeform String

**迁移脚本（按顺序）**：
1. `ALTER TABLE users ADD COLUMN merged_into_user_id ...`
2. `CREATE TABLE reservation_claim_tokens ...`
3. `ALTER TABLE orders DROP CONSTRAINT orders_reservationId_key` (去掉 unique)
4. `ALTER TABLE orders ADD COLUMN reservation_yurt_id ...` (nullable 先加)
5. **回填 `Order.reservationYurtId`**：对每个现有 Order，查对应 Reservation 的唯一 ReservationYurt 行（v2 迁移 `cfa1ecc` 回填过，每个 reservation 至少 1 个 ReservationYurt），把 `reservationYurtId` 设为该行 id
6. `ALTER TABLE orders ALTER COLUMN reservation_yurt_id SET NOT NULL + ADD UNIQUE`
7. 条件 unique index：`reservation_yurt_date_active`
8. Backfill：为历史 `holdByAdmin=true` + 非终结状态的 reservation 生成 token
9. （可选）电话号码 E.164 归一化的 `user_contact_entries` 清洗

---

## 6. Settings 使用

| Key | v3 处理 |
|---|---|
| `require_email_verification` | 保留不启用（默认 false） |
| `admin_deposit_deadline_hours` (48) | ✅ 接线到代客单 paymentDeadline |
| `reactivation_deadline_hours` | ⏸ v3 不用（用"延长 24h"替代） |
| `menu_deadline_days` (7) | ⏸ 下一轮菜单锁定 |
| `menu_reminder_*` | ⏸ 下一轮 |
| `inquiry_big_order_threshold` (30) | ✅ 自动打标签 |
| `inquiry_full_booking_threshold` (55) | ✅ 自动打标签 |
| `inquiry_urgent_days` (7) | ✅ urgent 标签 |
| `inquiry_vip_confirmed_count` (3) | ✅ vip 标签（排除 pre-claim 历史） |
| `inquiry_timeout_warn_hours` (24) | ✅ cron push |
| `inquiry_timeout_escalate_hours` (48) | ✅ cron 升级 |
| `inquiry_auto_expire_days` (7) | ✅ cron 过期 |

v3 启用 **8 个**，另 6 个保留到下一轮。

---

## 7. 安全加固（全局）

| 项 | 措施 |
|---|---|
| `callbackUrl` 开放重定向 | 校验 same-origin + 路径白名单 |
| Register 暴刷 | per-IP rate limit（5/hour） |
| Claim 暴刷 | per-IP rate limit（10/hour） + token 熵 256 bits |
| 并发 claim | DB 级 `UPDATE ... WHERE consumedAt IS NULL` 原子性 + SERIALIZABLE |
| 并发 hold 双占 | 条件 unique index on (yurtId, date, active) |
| Token 长期有效 | admin 可 revoke + 账户被删时 cascade |
| OAuth 取消回退 | `/login?error=access_denied` → 自动切到 email 密码 tab，保留 callbackUrl |
| 手机号归一化 | 存入前 E.164 格式（后续做，不阻塞 v3） |

---

## 8. GDPR / 数据删除（Q7）

**用户主动请求数据删除**（admin 代为执行）：

1. 找到该 user（含其 `mergedIntoUserId` 链）
2. 在事务内：
   - User 记录**软删**：
     - `email = deleted-${id}@deleted.local`
     - `name = null`, `phone = null`, `wechatId = null`, `image = null`
     - `passwordHash = null`, `unsubscribeToken = null`
   - 删除 `UserContactEntry` 所有记录
   - 删除 `PushSubscription` 所有记录
   - 删除 `Account`（OAuth 链接）所有记录
   - **保留** Reservations / Orders（财务记录，法规要求）——但 reservation 上的 `specialRequests` 清空
   - `ActivityLog` 保留（审计），但 `details.name` 脱敏
3. Activity log: `action=USER_DATA_DELETED`

**不删除的部分**：Reservation 本身（业务记录）、财务数据、审计日志。客户姓名在 reservation 查询时显示为 "[Deleted User]"。

**v3 范围**：只写 admin manual script（`scripts/delete-user-data.ts`），不做 UI 自助删除（小业务规模无必要）。

---

## 9. 实施顺序

### Phase 1 — Schema & Infrastructure（基础）
1. `ReservationClaimToken` model + migration
2. `User.mergedIntoUserId` + migration
3. 条件 unique index on `(yurtId, date, active)` migration
4. Token backfill script for 历史代客单
5. Claim API 重构（token 校验 + 账户合并 + 原子性 + 状态白名单）
6. Copy Link 按钮生成带 token URL；`/claim` 接受 token

### Phase 2 — Admin 代客改进 + 多包支持
1. **Schema**: `Order.reservationId` 去 unique + 加 `Order.reservationYurtId` + 回填迁移
2. 接线 `admin_deposit_deadline_hours`
3. cron `expire-reservations` 加显式 `holdByAdmin=false` 过滤
4. Detail 页倒计时 + 超期 banner
5. "延长 24h" 按钮 + 可选 email 通知（placeholder 跳过）
6. "释放此预约" 按钮 + 二次确认
7. Cancel API 加 "isReleaseHold" 分支（跳邮件）
8. List 页 "超期未付代客单" filter
9. Placeholder "无邮箱"警示条
10. **`CreateReservationModal` 改多选 yurt**（1-3 个），显示 "押金 $300×N"
11. **POST /api/reservations admin 分支**：创建 N 个 `ReservationYurt` + N 个 `Order`（事务）
12. 客户/admin 预约详情页渲染 **N 个 Order tab**（每包独立菜单）

### Phase 3 — 登录门槛
1. `/booking/*` 加 middleware auth guard（同 `/admin/*` 模式）
2. `callbackUrl` same-origin 校验
3. `/claim` 页内联登录/注册 tab + 完整注册字段 + 自动 claim
4. OAuth 取消回退 UX
5. Register / Login rate limit

### Phase 4 — Inquiry（咨询单）
1. `POST /api/inquiries` + 自动打标签 + rate limit
2. `GET /api/inquiries` admin 列表
3. `PATCH /api/inquiries/[id]`（状态流转 + comment）
4. `POST /api/inquiries/[id]/convert` 转为 reservation
5. `/inquiries/new` 客户端表单 + 预填
6. `/inquiries/[id]/submitted` 确认页
7. `/admin/inquiries` 列表（默认排序：unclaimed + urgent 优先）
8. `/admin/inquiries/[id]` 详情 + comment 线 + 转预约操作
9. cron `inquiry-timeouts` + `inquiry-auto-expire`（UTC 00:00 跑）
10. Admin push 通知

### Phase 5 — 前端入口
1. `/booking/start` 双卡片选择页
2. `/booking/details` >30 拦截 modal
3. 首页 CTA 调整（根据登录状态动态 link）

### Phase 6 — GDPR script
1. `scripts/delete-user-data.ts`

---

## 10. 已决定（无需再问）

| # | 决定 |
|---|---|
| D1 | Inquiry 不收押金 |
| D2 | 代客单软 deadline，admin 主导释放 |
| D3 | Token + admin 分享摩擦，无 SMS/邮箱 OTP |
| D4 | 联系客户面板：已有，增量改 |
| Q1 | **包是内部概念**，客户只填人数 |
| Q2 | >30 必须 Inquiry（单包容量上限） |
| Q3 | 押金固定 $300 / 包，Inquiry 多包则 $300×N |
| Q4 | 延长无次数限制，每次写 log + 有 email 则发 |
| Q5 | 释放 = `status=CANCELLED` + `cancelReason`，业务规则分支 email；不加 enum |
| Q6 | Claim 内联注册收**完整字段** |
| Q7 | 软删 + 保留 reservation / order，admin manual script |

---

## 11. 下一步

本 design 已闭环。下一步写 `2026-04-20-booking-redesign-plan.md`，把 §9 的 Phase 1-6 拆成每一步的文件改动 + 提交粒度 + 测试点。
