# Reservation Import — Design (2026-04-16)

## Goal

Migrate 119 historical reservations from `test-data/appointment-data.xlsx` into the new system DB. Generate a follow-up file listing 10 red-flagged rows for the owner to call/text customers about.

## Source data

- 129 rows parsed (`scripts/parse-excel.js` already produced `test-data/appointment-data-parsed.xlsx`)
  - 102 green (clean) → import
  - 17 yellow (guest count missing, default applied) → import + flag in note
  - 10 red (same-date duplicate or anomaly) → skip + write to follow-up
- Date range: 2026-04-18 → 2026-11-14
- Zero duplicate names across importable rows (no merge ambiguity)

## Pre-conditions

- Test users + reservations already cleaned (verified empty)
- 2 ADMIN users remain: `chengxin708@gmail.com`, `jimmy@flanyc.com`
- Yurts: room-1 / room-2 / room-3 already seeded

## User creation rules

- One User per Excel row (no duplicate names exist, so no dedup needed)
- Real email if Excel has one, otherwise placeholder: `<sanitized-name>@placeholder.local`
- `sanitized-name` = lowercase, ASCII letters/digits only, spaces → dots, fall back to `guest-<index>` if name is non-ASCII
- role = `CUSTOMER`
- phone copied as-is from Excel (may be empty)
- `name` = cleaned name (parser already strips "微信" / "波电话" / etc.)

## Reservation creation rules

- `status: CONFIRMED`
- `depositAmount: 300`, `depositStatus: CONFIRMED`, `depositConfirmedAt: now`
- `yurtId: null` (let auto-assignment / admin handle)
- `manuallyAssigned: false`
- `confirmationCode`: new BF-XXXXXX (6 chars, A-Z0-9 minus ambiguous)
- `guestCount`: from parser (Excel value or default by yurt request hint)
- `specialRequests`: null (real notes go to ReservationNote, not specialRequests)

## Notes integration

For each imported reservation, create one **pinned** `ReservationNote` authored by `chengxin708`. The note captures **every piece of context from the source row** that does not map to a structured field — nothing thrown away.

Excel column mapping (raw col indices):
- `[0]` 日期 → `Reservation.date` (structured, not in note)
- `[1]` 时间/标签 → **note** (e.g. `母亲节`, `Memorial day`, `Request 1230 pm`, time serial)
- `[2]` 人数 → `Reservation.guestCount` (structured) + **note if raw differs from parsed** (e.g. `18大6小` → `24`)
- `[3]` 名字 → `User.name` (cleaned) + **note original if cleaning altered it** (e.g. `McKenzie (paid by LAUREN RALEY)`)
- `[4]` 邮箱 → `User.email` if `@` present, else **note** (e.g. `微信`, `Bobo Farm 群`, `moved from 5/16/26`, `waiting for deposit`, `888`)
- `[5]` 电话 → `User.phone` (structured) + **note any non-phone fragment found**
- `[6]` 付款人 → **note** (e.g. `????`, `waiting for Deposit`)
- `[7]`–`[10]` → **note any non-empty value** (e.g. `Austin Hee`, `925-202-1273`)

Note template (lines omitted if not applicable):

```
导入自历史数据 (2026-04-16)
原始姓名: <raw col[3] if differs from cleaned>
联系方式: <WeChat | Bobo群 | other col[4] non-email value>
特殊日期/时间: <col[1] if non-empty>
原始人数: <raw col[2] if non-numeric or differs> → 估算 <parsed count>
付款备注: <col[6] if non-empty>
邮箱栏其他内容: <col[4] if non-email and not standard contact>
其他字段: <col[7..10] joined by " | "> 
⚠️ 人数为估算值 (原始: "<raw>")    ← yellow rows only, replaces "原始人数" line
```

Always at least the first line is written, ensuring traceability.

## ActivityLog entries

For each reservation, log:
- `userId: <chengxin708 id>`
- `action: RESERVATION_CREATED`
- `targetType: Reservation`
- `targetId: <new reservation id>`
- `details: { source: 'excel-import-2026-04-16', date: <iso>, guestCount, originalRow: <row index> }`

## Follow-up file (for red rows)

Write two files:

1. **`test-data/import-followup.xlsx`** — columns: 日期 / 姓名 / 原始人数 / 联系方式 / 电话 / 标记原因 / 建议询问内容
2. **`test-data/import-followup.md`** — Markdown table for quick read / copy-paste

Each red row gets a "建议询问内容" derived from its flag reason (e.g., "请确认实际人数" / "请确认是否为重复预约").

## Idempotency / safety

- Script first counts existing reservations; if `> 0`, abort with message ("先清空 reservation 表再跑")
- `--dry-run` flag prints planned actions without writing to DB
- All writes wrapped in `prisma.$transaction` (single transaction per row, not all-or-nothing — if row N fails, rows 1..N-1 are committed and row N+1..119 won't run)

## Files

- New: `scripts/import-reservations.ts`
- Output: `test-data/import-followup.xlsx`, `test-data/import-followup.md`
- Reuses parsing helpers inline (instead of importing parse-excel.js, which is JS not TS)

## Run

```bash
cd next-app
npx tsx scripts/import-reservations.ts --dry-run    # preview
npx tsx scripts/import-reservations.ts              # commit
```
