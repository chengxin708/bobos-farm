import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create admin user
  const adminPassword = await hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@bobosfarm.com" },
    update: {},
    create: {
      email: "admin@bobosfarm.com",
      name: "Jimmy",
      phone: "(516) 272-9999",
      passwordHash: adminPassword,
      role: "ADMIN",
      emailVerified: new Date(),
    },
  });
  console.log("Admin user created:", admin.email);

  // Create demo customer
  const customerPassword = await hash("customer123", 12);
  const customer = await prisma.user.upsert({
    where: { email: "john@example.com" },
    update: {},
    create: {
      email: "john@example.com",
      name: "John Smith",
      phone: "(555) 123-4567",
      passwordHash: customerPassword,
      role: "CUSTOMER",
      emailVerified: new Date(),
    },
  });
  console.log("Demo customer created:", customer.email);

  // Clear old yurts (cascades to reservations + availability)
  // Remove any yurts that aren't the 3 current rooms
  await prisma.yurt.deleteMany({
    where: { id: { notIn: ["room-1", "room-2", "room-3"] } },
  });
  console.log("Old yurts cleared");

  // Create 3 private rooms (包房)
  const yurts = await Promise.all([
    prisma.yurt.upsert({
      where: { id: "room-1" },
      update: { name: "#1", alias: "大", capacity: 30, sortOrder: 1 },
      create: {
        id: "room-1",
        name: "#1",
        alias: "大",
        capacity: 30,
        status: "ACTIVE",
        sortOrder: 1,
      },
    }),
    prisma.yurt.upsert({
      where: { id: "room-2" },
      update: { name: "#2", alias: "中", capacity: 24, sortOrder: 2 },
      create: {
        id: "room-2",
        name: "#2",
        alias: "中",
        capacity: 24,
        status: "ACTIVE",
        sortOrder: 2,
      },
    }),
    prisma.yurt.upsert({
      where: { id: "room-3" },
      update: { name: "#3", alias: "小", capacity: 16, sortOrder: 3 },
      create: {
        id: "room-3",
        name: "#3",
        alias: "小",
        capacity: 16,
        status: "ACTIVE",
        sortOrder: 3,
      },
    }),
  ]);
  console.log("Rooms created:", yurts.map((y) => `${y.name}(${y.alias}) ${y.capacity}`).join(", "));

  // ── Menu (real Bo Farm menu — Authentic Northeast Chinese / Dongbei) ──
  // Source of truth: Bo Farm Menu.docx (5 categories, 34 dishes).
  // Recovered 2026-05-21 after a Supabase schema reset wiped manually-added
  // items; this section is now authoritative — edits should be made HERE
  // and synced to DB via `npm run db:seed`.
  //
  // Image strategy: only items whose photos still live in Supabase storage
  // (bucket `menu-images/menu/*.webp`) have an imageUrl. Others render the
  // placeholder cutlery icon in the bill subdomain UI. Add more by uploading
  // via `scripts/upload-dish.ts` and writing the path here.

  const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const dishImg = (name: string) =>
    supabaseBase
      ? `${supabaseBase}/storage/v1/object/public/menu-images/menu/${name}.webp`
      : null;

  // Wipe placeholder data so a re-seed produces exactly the real menu.
  // (Bill subdomain's QuickReceiptItem snapshots names+prices, so it's
  // unaffected by menu_items deletes — its menuItemId column is nullable
  // with no FK.)
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();

  // Categories (sortOrder controls sidebar order in bill subdomain UI)
  const cats = await Promise.all([
    prisma.menuCategory.create({ data: { id: "cat-main", nameEn: "Main Course", nameZh: "主菜", sortOrder: 1 } }),
    prisma.menuCategory.create({ data: { id: "cat-stew", nameEn: "Traditional Stew Dishes", nameZh: "铁锅炖", sortOrder: 2 } }),
    prisma.menuCategory.create({ data: { id: "cat-stirfry", nameEn: "Stir Fried Courses", nameZh: "热菜", sortOrder: 3 } }),
    prisma.menuCategory.create({ data: { id: "cat-cold", nameEn: "Variety Tasty Salads", nameZh: "凉菜", sortOrder: 4 } }),
    prisma.menuCategory.create({ data: { id: "cat-staples", nameEn: "Staples", nameZh: "主食", sortOrder: 5 } }),
  ]);
  console.log("Menu categories created:", cats.map((c) => `${c.nameEn} (${c.nameZh})`).join(", "));

  // Items. EN names preserved verbatim from the docx (typos and all) at the
  // user's request; ZH normalised to Simplified Chinese for project consistency.
  type ItemSeed = {
    categoryId: string;
    nameEn: string;
    nameZh: string;
    price: number;
    image?: string;
    sortOrder: number;
  };
  const items: ItemSeed[] = [
    // ── Main Course (主菜) ──
    { categoryId: "cat-main", nameEn: "Authentic Chinese Roasted Whole Lamb", nameZh: "烤全羊", price: 880, image: "roast-whole-lamb", sortOrder: 1 },

    // ── Traditional Stew Dishes (铁锅炖) ──
    { categoryId: "cat-stew", nameEn: "Goose Stew in cast iron wok", nameZh: "铁锅炖大鹅", price: 158, image: "goose-stew", sortOrder: 1 },
    { categoryId: "cat-stew", nameEn: "Fish stew in cast iron pot", nameZh: "铁锅德莫利炖鱼", price: 88, image: "fish-stew-demoli", sortOrder: 2 },
    { categoryId: "cat-stew", nameEn: "Chicken and mushroom stew", nameZh: "小鸡炖磨菇", price: 118, sortOrder: 3 },
    { categoryId: "cat-stew", nameEn: "Beer Duck stew", nameZh: "铁锅炖啤酒鸭", price: 128, sortOrder: 4 },
    { categoryId: "cat-stew", nameEn: "Pork Ribs and Green Beans stew", nameZh: "铁锅排骨炖豆角", price: 88, sortOrder: 5 },
    { categoryId: "cat-stew", nameEn: "Pork Ribs and Sauerkraut stew", nameZh: "铁锅排骨炖酸菜", price: 88, sortOrder: 6 },
    { categoryId: "cat-stew", nameEn: "Sauerkraut stew with pork belly & vermicelli noodles", nameZh: "汆白肉", price: 88, sortOrder: 7 },

    // ── Stir Fried Courses (热菜) ──
    { categoryId: "cat-stirfry", nameEn: "Stir Fried Sichuan Bacon", nameZh: "四川炒腊肉", price: 48, sortOrder: 1 },
    { categoryId: "cat-stirfry", nameEn: "Stir fried Tofu skin with hot pepper", nameZh: "尖椒干豆腐", price: 28, sortOrder: 2 },
    { categoryId: "cat-stirfry", nameEn: "Spicy stir fried cabbage", nameZh: "手撕包菜", price: 28, sortOrder: 3 },
    { categoryId: "cat-stirfry", nameEn: "Stir fried Sauerkraut and Clear Noodle", nameZh: "渍菜粉", price: 28, sortOrder: 4 },
    { categoryId: "cat-stirfry", nameEn: "Spicy and sour shredded potato", nameZh: "酸辣土豆丝", price: 28, sortOrder: 5 },
    { categoryId: "cat-stirfry", nameEn: "Organic and fresh omelet", nameZh: "笨蛋炒大葱", price: 28, sortOrder: 6 },
    { categoryId: "cat-stirfry", nameEn: "Sweet n sour pork Dongbei style", nameZh: "锅包肉", price: 48, sortOrder: 7 },
    { categoryId: "cat-stirfry", nameEn: "Chives and Egg", nameZh: "韭菜炒蛋", price: 28, sortOrder: 8 },
    { categoryId: "cat-stirfry", nameEn: "Spring Chives and eggs Stir fry", nameZh: "韭黄炒蛋", price: 28, sortOrder: 9 },
    { categoryId: "cat-stirfry", nameEn: "Stir-fried Eggs with Chinese toona", nameZh: "香椿炒蛋", price: 28, sortOrder: 10 },
    { categoryId: "cat-stirfry", nameEn: "Stir-fried pickled long beans with minced pork", nameZh: "酸豆角肉末", price: 28, sortOrder: 11 },
    { categoryId: "cat-stirfry", nameEn: "Spicy Cabbage and Scallop Potato", nameZh: "辣白菜土豆片", price: 28, sortOrder: 12 },

    // ── Variety Tasty Salads (凉菜) ──
    { categoryId: "cat-cold", nameEn: "Cucumber salad", nameZh: "凉拌黄瓜", price: 28, sortOrder: 1 },
    { categoryId: "cat-cold", nameEn: "Dried bean curd stick salad", nameZh: "凉拌腐竹", price: 28, sortOrder: 2 },
    { categoryId: "cat-cold", nameEn: "Special fungus salad", nameZh: "凉拌木耳", price: 28, sortOrder: 3 },
    { categoryId: "cat-cold", nameEn: "Mixed veggie salad", nameZh: "家常凉菜", price: 28, sortOrder: 4 },
    { categoryId: "cat-cold", nameEn: "Cold cut Beef in special Sause", nameZh: "凉拌牛肉", price: 38, sortOrder: 5 },
    { categoryId: "cat-cold", nameEn: "Shredded Pig's ear in hot sauce", nameZh: "红油耳丝", price: 38, sortOrder: 6 },
    { categoryId: "cat-cold", nameEn: "Tofu Salad with scallion", nameZh: "小葱拌豆腐", price: 28, sortOrder: 7 },
    { categoryId: "cat-cold", nameEn: "Thousand-year Egg and Tofu salad", nameZh: "皮蛋豆腐", price: 28, sortOrder: 8 },
    { categoryId: "cat-cold", nameEn: "Cilantro & pepper salad", nameZh: "老虎菜", price: 28, sortOrder: 9 },
    { categoryId: "cat-cold", nameEn: "Northeast Jelly Noodle salad", nameZh: "东北大拉皮", price: 28, sortOrder: 10 },
    { categoryId: "cat-cold", nameEn: "Shredded potato salad", nameZh: "凉拌土豆丝", price: 28, sortOrder: 11 },
    { categoryId: "cat-cold", nameEn: "Mixed veggie salad with Dipping sauce", nameZh: "沾酱菜", price: 28, sortOrder: 12 },

    // ── Staples (主食) ──
    { categoryId: "cat-staples", nameEn: "Fried Rice", nameZh: "炒饭", price: 28, sortOrder: 1 },
    { categoryId: "cat-staples", nameEn: "Fried Noodle", nameZh: "炒面", price: 28, sortOrder: 2 },
  ];

  for (const it of items) {
    await prisma.menuItem.create({
      data: {
        categoryId: it.categoryId,
        nameEn: it.nameEn,
        nameZh: it.nameZh,
        price: it.price,
        imageUrl: it.image ? dishImg(it.image) : null,
        isActive: true,
        sortOrder: it.sortOrder,
      },
    });
  }
  console.log("Menu items created:", items.length);

  // Create default system settings
  const settings = [
    {
      key: "deposit_amount",
      value: "300",
      description: "Deposit amount in USD",
    },
    {
      key: "payment_timeout_hours",
      value: "24",
      description: "Hours before unpaid customer self-serve reservation auto-expires",
    },
    {
      key: "max_advance_months",
      value: "3",
      description: "Maximum months in advance for booking",
    },
    {
      key: "min_advance_days",
      value: "1",
      description: "Minimum days in advance for booking",
    },
    {
      key: "cancel_refund_days",
      value: "3",
      description: "Minimum days before event for refund eligibility",
    },
    {
      key: "guest_warning_threshold",
      value: "7",
      description: "Guest count threshold for size warning",
    },
    {
      key: "zelle_email",
      value: "jenny@bobosfarm.com",
      description: "Zelle payment email",
    },
    {
      key: "payment_memo_format",
      value: "BOBO-{DATE}-{NAME}",
      description: "Payment memo format template",
    },
    {
      key: "order_deadline_days",
      value: "3",
      description: "Days before event to lock orders",
    },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }
  console.log("System settings created:", settings.length);

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
