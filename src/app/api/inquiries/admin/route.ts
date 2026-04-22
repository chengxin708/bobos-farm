import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth-options"
import { z } from "zod"
import { computeInquiryTags } from "@/lib/inquiry-tagging"
import { resolveAdminProxyCustomer } from "@/lib/admin-customer-resolver"

const adminCreateInquirySchema = z
  .object({
    guestName: z.string().min(1, "guestName is required"),
    guestEmail: z.union([z.string().email("Invalid email"), z.literal("")]).optional(),
    guestPhone: z.string().optional(),
    guestWechatId: z.string().max(100).optional(),
    preferredDate: z
      .string()
      .min(1)
      .refine((v) => !isNaN(Date.parse(v)), { message: "Invalid preferredDate" }),
    guestCountMin: z.number().int().positive(),
    guestCountMax: z.number().int().positive(),
    note: z.string().max(4000).nullish(),
  })
  .refine((d) => d.guestCountMax >= d.guestCountMin, {
    message: "guestCountMax must be >= guestCountMin",
    path: ["guestCountMax"],
  })
  .refine(
    (d) => !!(d.guestEmail?.trim() || d.guestPhone?.trim() || d.guestWechatId?.trim()),
    {
      message: "At least one contact method (email, phone, or WeChat) is required",
      path: ["guestEmail"],
    },
  )

/**
 * POST /api/inquiries/admin
 *
 * Admin logs a phone / WeChat / in-person inquiry on behalf of a customer.
 * Resolves the customer via the shared admin-proxy resolver (email first,
 * then placeholder soft-match on phone/wechat, else new placeholder) and
 * creates the Inquiry record linked to that user.
 *
 * The public POST /api/inquiries intentionally rejects ADMIN role (self-
 * serve only). This admin endpoint fills that gap without weakening the
 * public one.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const role = (session.user as { role?: string }).role
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 })
    }

    const body = await req.json()
    const parsed = adminCreateInquirySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const data = parsed.data

    const customer = await resolveAdminProxyCustomer(
      prisma,
      {
        guestName: data.guestName,
        guestEmail: data.guestEmail,
        guestPhone: data.guestPhone,
        guestWechatId: data.guestWechatId,
      },
      session.user.id,
    )

    const preferredDate = new Date(data.preferredDate)
    const { tags, priority } = await computeInquiryTags(prisma, {
      userId: customer.id,
      userCreatedAt: customer.createdAt,
      guestCountMax: data.guestCountMax,
      preferredDate,
    })

    const inquiry = await prisma.inquiry.create({
      data: {
        userId: customer.id,
        preferredDate,
        guestCountMin: data.guestCountMin,
        guestCountMax: data.guestCountMax,
        note: data.note ?? null,
        priority,
        tags,
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: "INQUIRY_SUBMITTED",
        targetType: "Inquiry",
        targetId: inquiry.id,
        details: {
          createdByAdmin: true,
          customerId: customer.id,
          guestCountMin: data.guestCountMin,
          guestCountMax: data.guestCountMax,
          priority,
          tags,
        },
      },
    })

    return NextResponse.json({ inquiry }, { status: 201 })
  } catch (error) {
    console.error("Failed to create admin inquiry:", error)
    return NextResponse.json({ error: "Failed to create inquiry" }, { status: 500 })
  }
}
