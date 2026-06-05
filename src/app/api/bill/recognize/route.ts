import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/bill/session";
import { recognizeOrder } from "@/lib/bill/ai";

const JPEG_PREFIX = "data:image/jpeg;base64,";
const MAX_IMAGE_BYTES = 2.5 * 1024 * 1024; // ~2.5 MB decoded

interface MatchedLine {
  menuItemId: string;
  nameEn: string;
  nameZh: string | null;
  priceCents: number;
  quantity: number;
  rawText: string;
  confidence: number | null;
}

interface UnmatchedLine {
  rawText: string;
  quantity: number;
  confidence: number | null;
}

const bodySchema = z.object({
  image: z
    .string()
    .startsWith(JPEG_PREFIX, "Image must be a JPEG data URL")
    .refine((image) => {
      const base64 = image.slice(JPEG_PREFIX.length);
      // Decoded byte length of a base64 string (ignoring whitespace/padding).
      const len = base64.replace(/=+$/, "").length;
      return Math.floor((len * 3) / 4) <= MAX_IMAGE_BYTES;
    }, "Image is too large"),
});

export async function POST(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const { ok, ai } = await verifySession(cookie);
  if (!ok || !ai) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid image" }, { status: 400 });
  }

  const items = await prisma.menuItem.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: [
      { category: { sortOrder: "asc" } },
      { sortOrder: "asc" },
      { nameEn: "asc" },
    ],
  });

  // 1-based numbered menu + index -> item map fed to the model.
  const byNumber = new Map<number, (typeof items)[number]>();
  const numberedMenu = items
    .map((item, idx) => {
      const n = idx + 1;
      byNumber.set(n, item);
      const label = item.nameZh
        ? `${item.nameZh} / ${item.nameEn}`
        : item.nameEn;
      return `${n}. ${label} $${item.price.toFixed(2)}`;
    })
    .join("\n");

  let lines;
  try {
    lines = await recognizeOrder(parsed.data.image, numberedMenu);
  } catch (error) {
    console.error("Bill AI recognition failed:", error);
    return NextResponse.json({ error: "Recognition failed" }, { status: 500 });
  }

  const matched: MatchedLine[] = [];
  const unmatched: UnmatchedLine[] = [];
  for (const line of lines) {
    const item = line.itemNo != null ? byNumber.get(line.itemNo) : undefined;
    if (item) {
      matched.push({
        menuItemId: item.id,
        nameEn: item.nameEn,
        nameZh: item.nameZh,
        priceCents: Math.round(item.price * 100),
        quantity: line.quantity,
        rawText: line.rawText,
        confidence: line.confidence,
      });
    } else {
      unmatched.push({
        rawText: line.rawText,
        quantity: line.quantity,
        confidence: line.confidence,
      });
    }
  }

  return NextResponse.json({ matched, unmatched });
}
