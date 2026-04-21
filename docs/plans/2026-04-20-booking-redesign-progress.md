# Booking Redesign v3 — Progress Tracker

**Design:** `./2026-04-20-booking-redesign-design.md`
**Plan:** `./2026-04-20-booking-redesign-plan.md`
**Status:** 完成（29/40 commit）+ Phase 7 UX 整合完成（5/5 commit）
**Last updated:** 2026-04-20

---

## 如何继续（给新 session）

1. 读 design + plan 两份文档
2. 看下面"下一步"指向的 commit
3. 做完一个 commit 就勾上 checkbox + 更新 "Last updated" + push 到 GitHub
4. 遇到不确定先停下来问用户，别自作主张改 design

**下一步**: 运维上线步骤（见下方 Phase 1 完成后必做），然后生产验证。所有 6 Phase 的代码已合并到 main。

---

## Phase 1 — Schema & Infrastructure（0/7）

- [x] 1.1 `feat(booking-redesign): add ReservationClaimToken model`
- [x] 1.2 `feat(booking-redesign): add User.mergedIntoUserId for soft-merge audit`
- [x] 1.3 `feat(booking-redesign): Order.reservationYurtId for multi-package orders`
- [x] 1.4 `feat(booking-redesign): prevent concurrent yurt+date double-hold`
- [x] 1.5 `feat(booking-redesign): claim token util and historical backfill`
- [x] 1.6 `feat(booking-redesign): claim API with token validation + account merge`
- [x] 1.7 `feat(booking-redesign): admin copy-link generates tokenized URL`

**Phase 1 完成后必做**：
- [ ] 本地 + 生产 migrate deploy 成功
- [ ] 跑 `npm run db:backfill-tokens` 回填历史代客单 token
- [ ] admin UI 手动验证复制的链接能 claim
- [ ] jest 全绿

---

## Phase 2 — Admin 代客改进 + 多包（0/8）

- [x] 2.1 `feat(booking-redesign): wire admin_deposit_deadline_hours for proxy bookings`
- [x] 2.2 `feat(booking-redesign): admin proxy detail countdown + overdue banner + no-email warning`
- [x] 2.3 `feat(booking-redesign): extend-hold button for admin proxy deadlines`
- [x] 2.4 `feat(booking-redesign): release-hold action distinct from customer cancel`
- [x] 2.5 `feat(booking-redesign): overdue admin holds filter in reservations list`
- [x] 2.6 `feat(booking-redesign): multi-yurt selector for admin proxy bookings`
- [x] 2.7 `feat(booking-redesign): admin multi-yurt reservation creates N orders`
- [x] 2.8 `feat(booking-redesign): reservation detail renders per-package order tabs`

---

## Phase 3 — 登录门槛 + Claim 内联注册（0/4）

- [x] 3.1 `feat(booking-redesign): require auth for /booking/* routes`
- [x] 3.2 `fix(booking-redesign): validate callbackUrl to prevent open redirect`
- [x] 3.3 `feat(booking-redesign): inline login/register on /claim with full registration fields`
- [x] 3.4 `feat(booking-redesign): oauth cancel fallback + rate limits on auth endpoints`

---

## Phase 4 — Inquiry 系统（0/6）

- [x] 4.1 `feat(booking-redesign): inquiry submission API with auto-tagging`
- [x] 4.2 `feat(booking-redesign): admin inquiry list + detail + comment APIs`
- [x] 4.3 `feat(booking-redesign): customer inquiry submission form`
- [x] 4.4 `feat(booking-redesign): customer inquiry list page`
- [x] 4.5 `feat(booking-redesign): admin inquiry list + detail pages`
- [x] 4.6 `feat(booking-redesign): inquiry timeout + auto-expire cron jobs`

---

## Phase 5 — 前端入口（0/3）

- [x] 5.1 `feat(booking-redesign): booking start page with dual-path selection`
- [x] 5.2 `feat(booking-redesign): gate >30 guest count in self-serve flow`
- [x] 5.3 `feat(booking-redesign): homepage CTA routes through /booking/start`

---

## Phase 6 — GDPR 数据删除脚本（0/1）

- [x] 6.1 `feat(booking-redesign): admin data deletion script (GDPR)`

---

## Phase 7 — UX 整合（5/5）

2026-04-20 追加：Phase 5.1 的双卡片入口证明对客户是内部概念（预订 vs 咨询）的强推——用户不该关心这个区别。改为统一流程：所有人从 `/booking/date` 进入；中途根据人数范围/数量自动转咨询单。`/booking/start` 保留为 redirect 防止死链。

- [x] 7.1 `feat(booking-redesign): extract DatePickerCalendar shared component`
- [x] 7.2 `feat(booking-redesign): add GuestRangePicker component`
- [x] 7.3 `feat(booking-redesign): rework /inquiries/new with new pickers`
- [x] 7.4 `feat(booking-redesign): range picker + auto inquiry conversion in details`
- [x] 7.5 `feat(booking-redesign): remove /booking/start dual-path entry`

转咨询触发条件：人数选范围（min != max）或 max > 30；自助预约上限继续按 Phase 5.2 的 30 人保持不变。

---

## 重要约束（每个新 session 必读）

1. **不自动触达客户**：系统不发 SMS、不对 placeholder 账户发邮件。所有客户通信靠 admin 手机粘贴发送（iMessage / WeChat）
2. **包是内部概念**：客户只填人数（≤30）和日期，押金固定 $300（单包）。admin 后端分配 yurt
3. **多包只能 admin 代客 / Inquiry 转换**，客户端自助流永远单包
4. **Admin 代客单永不自动过期**：cron 只过期 `holdByAdmin=false` 的客户自助单；代客单到期靠 admin 手动"释放"
5. **释放 ≠ 取消**：代客未付押金的释放不发取消邮件（见 `isReleaseHold` 分支逻辑）
6. **每个 commit 独立可部署**：migration 兼容现有代码，代码兼容老 schema（能单独 rollback）
7. **现有功能不许回归**：单包自助、claim 老链接、admin 单 yurt 代客都要继续工作
