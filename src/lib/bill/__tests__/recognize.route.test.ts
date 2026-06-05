import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "../session";

jest.mock("@/lib/prisma", () => ({
  prisma: { menuItem: { findMany: jest.fn() } },
}));
jest.mock("../session", () => ({
  ...jest.requireActual("../session"),
  verifySession: jest.fn(),
}));
jest.mock("../ai", () => ({ recognizeOrder: jest.fn() }));

import { POST } from "@/app/api/bill/recognize/route";
import { prisma } from "@/lib/prisma";
import { verifySession } from "../session";
import { recognizeOrder } from "../ai";

const mockedVerify = verifySession as jest.Mock;
const mockedFindMany = prisma.menuItem.findMany as unknown as jest.Mock;
const mockedRecognize = recognizeOrder as jest.Mock;

const IMAGE = "data:image/jpeg;base64,QUJDRA==";

function makeReq(body: unknown, cookie = "session-cookie"): NextRequest {
  const req = new NextRequest(new URL("http://bill.localhost:3000/api/bill/recognize"), {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (cookie) req.cookies.set(SESSION_COOKIE_NAME, cookie);
  return req;
}

const MENU_ITEMS = [
  {
    id: "m1",
    nameEn: "Kung Pao Chicken",
    nameZh: "宫保鸡丁",
    price: 12,
    isActive: true,
    category: { sortOrder: 0 },
  },
  {
    id: "m2",
    nameEn: "Spring Roll",
    nameZh: null,
    price: 3.5,
    isActive: true,
    category: { sortOrder: 1 },
  },
];

describe("POST /api/bill/recognize", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFindMany.mockResolvedValue(MENU_ITEMS);
  });

  it("returns 403 when the session is valid but ai is false", async () => {
    mockedVerify.mockResolvedValue({ ok: true, ai: false });
    const res = await POST(makeReq({ image: IMAGE }));
    expect(res.status).toBe(403);
    expect(mockedRecognize).not.toHaveBeenCalled();
  });

  it("returns 403 when the session is invalid", async () => {
    mockedVerify.mockResolvedValue({ ok: false, ai: false });
    const res = await POST(makeReq({ image: IMAGE }));
    expect(res.status).toBe(403);
  });

  it("returns 400 for a non-JPEG data URL", async () => {
    mockedVerify.mockResolvedValue({ ok: true, ai: true });
    const res = await POST(makeReq({ image: "data:image/png;base64,QUJD" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an oversized image", async () => {
    mockedVerify.mockResolvedValue({ ok: true, ai: true });
    const big = "data:image/jpeg;base64," + "A".repeat(4 * 1024 * 1024);
    const res = await POST(makeReq({ image: big }));
    expect(res.status).toBe(400);
  });

  it("maps matched and unmatched lines when ai is true", async () => {
    mockedVerify.mockResolvedValue({ ok: true, ai: true });
    mockedRecognize.mockResolvedValue([
      { itemNo: 1, rawText: "宫保鸡丁 x2", quantity: 2, confidence: 0.9 },
      { itemNo: null, rawText: "??? mystery", quantity: 1, confidence: 0.1 },
      { itemNo: 99, rawText: "out of range", quantity: 1, confidence: 0.5 },
    ]);
    const res = await POST(makeReq({ image: IMAGE }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.matched).toEqual([
      {
        menuItemId: "m1",
        nameEn: "Kung Pao Chicken",
        nameZh: "宫保鸡丁",
        priceCents: 1200,
        quantity: 2,
        rawText: "宫保鸡丁 x2",
        confidence: 0.9,
      },
    ]);
    expect(json.unmatched).toEqual([
      { rawText: "??? mystery", quantity: 1, confidence: 0.1 },
      { rawText: "out of range", quantity: 1, confidence: 0.5 },
    ]);
  });

  it("builds a 1-based numbered menu passed to recognizeOrder", async () => {
    mockedVerify.mockResolvedValue({ ok: true, ai: true });
    mockedRecognize.mockResolvedValue([]);
    await POST(makeReq({ image: IMAGE }));
    const [, numberedMenu] = mockedRecognize.mock.calls[0];
    expect(numberedMenu).toContain("1. 宫保鸡丁 / Kung Pao Chicken $12.00");
    expect(numberedMenu).toContain("2. Spring Roll $3.50");
  });

  it("returns 500 when recognizeOrder throws", async () => {
    mockedVerify.mockResolvedValue({ ok: true, ai: true });
    mockedRecognize.mockRejectedValue(new Error("model down"));
    const res = await POST(makeReq({ image: IMAGE }));
    expect(res.status).toBe(500);
  });
});
