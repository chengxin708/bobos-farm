# Booking Redesign v3 — Progress Tracker

**Design:** `./2026-04-20-booking-redesign-design.md`
**Plan:** `./2026-04-20-booking-redesign-plan.md`
**Status:** 进行中（25/40 commit — Phase 4 complete）
**Last updated:** 2026-04-20

---

## 如何继续（给新 session）

1. 读 design + plan 两份文档
2. 看下面"下一步"指向的 commit
3. 做完一个 commit 就勾上 checkbox + 更新 "Last updated" + push 到 GitHub
4. 遇到不确定先停下来问用户，别自作主张改 design

**下一步**: Phase 5 commit 5.1 (`feat(booking-redesign): booking start page with dual-path selection`)

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

- [ ] 5.1 `feat(booking-redesign): booking start page with dual-path selection`
- [ ] 5.2 `feat(booking-redesign): gate >30 guest count in self-serve flow`
- [ ] 5.3 `feat(booking-redesign): homepage CTA routes through /booking/start`

---

## Phase 6 — GDPR 数据删除脚本（0/1）

- [ ] 6.1 `feat(booking-redesign): admin data deletion script (GDPR)`

---

## 重要约束（每个新 session 必读）

1. **不自动触达客户**：系统不发 SMS、不对 placeholder 账户发邮件。所有客户通信靠 admin 手机粘贴发送（iMessage / WeChat）
2. **包是内部概念**：客户只填人数（≤30）和日期，押金固定 $300（单包）。admin 后端分配 yurt
3. **多包只能 admin 代客 / Inquiry 转换**，客户端自助流永远单包
4. **Admin 代客单永不自动过期**：cron 只过期 `holdByAdmin=false` 的客户自助单；代客单到期靠 admin 手动"释放"
5. **释放 ≠ 取消**：代客未付押金的释放不发取消邮件（见 `isReleaseHold` 分支逻辑）
6. **每个 commit 独立可部署**：migration 兼容现有代码，代码兼容老 schema（能单独 rollback）
7. **现有功能不许回归**：单包自助、claim 老链接、admin 单 yurt 代客都要继续工作
