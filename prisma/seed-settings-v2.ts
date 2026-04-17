/**
 * Seed script for M1.5 — new SystemSettings for booking redesign.
 *
 * Seeds 14 new settings used by M2-M6 milestones. Existing setting values are
 * NOT overwritten (upsert with empty update).
 *
 * Note: The SystemSetting schema only has `key`, `value`, `description` fields
 * — there is no `category` column. Groupings are handled in the admin UI.
 *
 * Run: `npx tsx prisma/seed-settings-v2.ts`
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface NewSetting {
  key: string;
  value: string;
  description: string;
}

const NEW_SETTINGS: NewSetting[] = [
  // Deposit
  {
    key: "admin_deposit_deadline_hours",
    value: "48",
    description: "Admin 代客订单默认支付窗口（小时）",
  },
  {
    key: "reactivation_deadline_hours",
    value: "24",
    description: "过期订单重激活后的支付窗口（小时）",
  },

  // Menu
  {
    key: "menu_deadline_days",
    value: "7",
    description: "菜单到店前锁定天数",
  },
  {
    key: "menu_reminder_days_early",
    value: "10",
    description: "首次菜单提醒（到店前 N 天）",
  },
  {
    key: "menu_reminder_days_last",
    value: "7",
    description: "最后菜单提醒（到店前 N 天）",
  },
  {
    key: "menu_reminder_days_visit",
    value: "1",
    description: "到店前一天提醒（到店前 N 天）",
  },

  // Inquiry
  {
    key: "inquiry_big_order_threshold",
    value: "30",
    description: "大单标签触发人数上限",
  },
  {
    key: "inquiry_full_booking_threshold",
    value: "55",
    description: "全包标签触发人数上限",
  },
  {
    key: "inquiry_urgent_days",
    value: "7",
    description: "急单触发天数（意向日期 < N 天）",
  },
  {
    key: "inquiry_vip_confirmed_count",
    value: "3",
    description: "VIP 标签触发历史订单数",
  },
  {
    key: "inquiry_timeout_warn_hours",
    value: "24",
    description: "咨询单首次提醒（小时）",
  },
  {
    key: "inquiry_timeout_escalate_hours",
    value: "48",
    description: "咨询单升级提醒（小时）",
  },
  {
    key: "inquiry_auto_expire_days",
    value: "7",
    description: "咨询单自动过期天数",
  },

  // Auth
  {
    key: "require_email_verification",
    value: "true",
    description: "是否强制邮箱验证才能预订",
  },
];

async function main() {
  console.log(`Seeding ${NEW_SETTINGS.length} new settings...`);

  for (const s of NEW_SETTINGS) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {}, // don't overwrite existing values
      create: s,
    });
    console.log(`  OK ${s.key} = ${s.value}`);
  }

  console.log(`Done. ${NEW_SETTINGS.length} settings seeded (new or preserved).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
