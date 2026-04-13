import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-options"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/tags
 * Returns all tags (public — used by customer menu page).
 * ?activeOnly=true to filter active tags only.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const activeOnly = searchParams.get("activeOnly") === "true"

    const tags = await prisma.tag.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { sortOrder: "asc" },
    })

    return NextResponse.json(tags)
  } catch (error) {
    console.error("Failed to fetch tags:", error)
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 })
  }
}

/**
 * POST /api/tags
 * Create a new tag. Admin only.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { key, nameEn, nameZh, color, sortOrder } = body

    if (!key || !nameEn) {
      return NextResponse.json({ error: "key and nameEn are required" }, { status: 400 })
    }

    // Check for duplicate key
    const existing = await prisma.tag.findUnique({ where: { key } })
    if (existing) {
      return NextResponse.json({ error: "Tag key already exists" }, { status: 409 })
    }

    const tag = await prisma.tag.create({
      data: {
        key: key.toLowerCase().replace(/\s+/g, "-"),
        nameEn,
        nameZh: nameZh || null,
        color: color || null,
        sortOrder: sortOrder ?? 0,
      },
    })

    return NextResponse.json(tag, { status: 201 })
  } catch (error) {
    console.error("Failed to create tag:", error)
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 })
  }
}
