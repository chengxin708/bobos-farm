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

  // Create menu categories
  const categories = await Promise.all([
    prisma.menuCategory.upsert({
      where: { id: "cat-whole-lamb" },
      update: {},
      create: {
        id: "cat-whole-lamb",
        nameEn: "Whole Lamb",
        nameZh: "烤全羊",
        sortOrder: 1,
      },
    }),
    prisma.menuCategory.upsert({
      where: { id: "cat-signature" },
      update: {},
      create: {
        id: "cat-signature",
        nameEn: "Signature Dishes",
        nameZh: "招牌菜",
        sortOrder: 2,
      },
    }),
    prisma.menuCategory.upsert({
      where: { id: "cat-iron-pot" },
      update: {},
      create: {
        id: "cat-iron-pot",
        nameEn: "Iron Pot Stews",
        nameZh: "铁锅炖",
        sortOrder: 3,
      },
    }),
    prisma.menuCategory.upsert({
      where: { id: "cat-cold" },
      update: {},
      create: {
        id: "cat-cold",
        nameEn: "Cold Dishes",
        nameZh: "凉菜",
        sortOrder: 4,
      },
    }),
    prisma.menuCategory.upsert({
      where: { id: "cat-staples" },
      update: {},
      create: {
        id: "cat-staples",
        nameEn: "Staples",
        nameZh: "主食",
        sortOrder: 5,
      },
    }),
    prisma.menuCategory.upsert({
      where: { id: "cat-beverages" },
      update: {},
      create: {
        id: "cat-beverages",
        nameEn: "Beverages",
        nameZh: "饮品",
        sortOrder: 6,
      },
    }),
  ]);
  console.log(
    "Menu categories created:",
    categories.map((c) => c.nameEn).join(", ")
  );

  // Create menu items
  const menuItems = await Promise.all([
    prisma.menuItem.upsert({
      where: { id: "item-roasted-whole-lamb" },
      update: {},
      create: {
        id: "item-roasted-whole-lamb",
        categoryId: "cat-whole-lamb",
        nameEn: "Roasted Whole Lamb",
        nameZh: "烤全羊",
        price: 880,
        descriptionEn:
          "Slow-roasted whole lamb with traditional Mongolian spices, serves 8-15",
        tags: ["Signature", "Pre-order"],
        advanceDaysRequired: 3,
        sortOrder: 1,
        imageUrl:
          "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80",
      },
    }),
    prisma.menuItem.upsert({
      where: { id: "item-half-lamb" },
      update: {},
      create: {
        id: "item-half-lamb",
        categoryId: "cat-whole-lamb",
        nameEn: "Half Lamb Roast",
        nameZh: "烤半只羊",
        price: 480,
        descriptionEn:
          "Half portion of our signature roasted lamb, perfect for groups of 4-8",
        tags: ["Signature"],
        advanceDaysRequired: 2,
        sortOrder: 2,
        imageUrl:
          "https://images.unsplash.com/photo-1529694157872-4e0c0f3b238b?w=400&q=80",
      },
    }),
    prisma.menuItem.upsert({
      where: { id: "item-lamb-rack" },
      update: {},
      create: {
        id: "item-lamb-rack",
        categoryId: "cat-whole-lamb",
        nameEn: "Lamb Rack",
        nameZh: "羊排",
        price: 48,
        descriptionEn: "Grilled rack of lamb with cumin and chili flakes",
        tags: ["Spicy"],
        sortOrder: 3,
        imageUrl:
          "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=400&q=80",
      },
    }),
    prisma.menuItem.upsert({
      where: { id: "item-iron-pot-lamb" },
      update: {},
      create: {
        id: "item-iron-pot-lamb",
        categoryId: "cat-signature",
        nameEn: "Iron Pot Lamb Stew",
        nameZh: "铁锅炖羊肉",
        price: 65,
        descriptionEn:
          "Hearty iron pot lamb stew with glass noodles, tofu, and fresh vegetables",
        tags: ["Popular"],
        sortOrder: 1,
        imageUrl:
          "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80",
      },
    }),
    prisma.menuItem.upsert({
      where: { id: "item-big-plate-chicken" },
      update: {},
      create: {
        id: "item-big-plate-chicken",
        categoryId: "cat-signature",
        nameEn: "Big Plate Chicken",
        nameZh: "大盘鸡",
        price: 38,
        descriptionEn:
          "Spicy braised chicken with potatoes and hand-pulled noodles",
        tags: ["Spicy"],
        sortOrder: 2,
        imageUrl:
          "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&q=80",
      },
    }),
    prisma.menuItem.upsert({
      where: { id: "item-cold-noodles" },
      update: {},
      create: {
        id: "item-cold-noodles",
        categoryId: "cat-signature",
        nameEn: "Cold Sesame Noodles",
        nameZh: "凉面",
        price: 16,
        descriptionEn:
          "Chilled noodles with sesame paste, cucumber, and spicy chili oil",
        tags: ["Cold"],
        sortOrder: 3,
        imageUrl:
          "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&q=80",
      },
    }),
    prisma.menuItem.upsert({
      where: { id: "item-lamb-dumplings" },
      update: {},
      create: {
        id: "item-lamb-dumplings",
        categoryId: "cat-staples",
        nameEn: "Lamb Dumplings",
        nameZh: "羊肉饺子",
        price: 18,
        descriptionEn:
          "Hand-made dumplings filled with lamb, scallion, and ginger",
        tags: ["Homemade"],
        sortOrder: 1,
        imageUrl:
          "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400&q=80",
      },
    }),
    prisma.menuItem.upsert({
      where: { id: "item-scallion-pancakes" },
      update: {},
      create: {
        id: "item-scallion-pancakes",
        categoryId: "cat-staples",
        nameEn: "Scallion Pancakes",
        nameZh: "葱油饼",
        price: 12,
        descriptionEn: "Crispy pan-fried scallion pancakes",
        tags: ["Homemade"],
        sortOrder: 2,
        imageUrl:
          "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=400&q=80",
      },
    }),
    prisma.menuItem.upsert({
      where: { id: "item-plum-juice" },
      update: {},
      create: {
        id: "item-plum-juice",
        categoryId: "cat-beverages",
        nameEn: "House Plum Juice",
        nameZh: "酸梅汤",
        price: 8,
        descriptionEn:
          "Traditional Chinese sour plum drink, refreshing and sweet",
        tags: ["Drink"],
        sortOrder: 1,
        imageUrl:
          "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&q=80",
      },
    }),
  ]);
  console.log("Menu items created:", menuItems.length);

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
