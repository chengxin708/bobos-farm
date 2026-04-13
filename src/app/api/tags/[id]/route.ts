import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-options"
import { prisma } from "@/lib/prisma"

/**
 * PATCH /api/tags/[id]
 * Update a tag. Admin only.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { nameEn, nameZh, color, sortOrder, isActive } = body

    const data: Record<string, unknown> = {}
    if (nameEn !== undefined) data.nameEn = nameEn
    if (nameZh !== undefined) data.nameZh = nameZh || null
    if (color !== undefined) data.color = color || null
    if (sortOrder !== undefined) data.sortOrder = sortOrder
    if (isActive !== undefined) data.isActive = isActive

    const tag = await prisma.tag.update({
      where: { id },
      data,
    })

    return NextResponse.json(tag)
  } catch (error) {
    console.error("Failed to update tag:", error)
    return NextResponse.json({ error: "Failed to update tag" }, { status: 500 })
  }
}

/**
 * DELETE /api/tags/[id]
 * Delete a tag. Admin only.
 * Also removes the tag key from all menu items that reference it.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Get the tag key before deleting
    const tag = await prisma.tag.findUnique({ where: { id } })
    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 })
    }

    // Remove tag key from all menu items that have it
    const itemsWithTag = await prisma.menuItem.findMany({
      where: { tags: { has: tag.key } },
      select: { id: true, tags: true },
    })

    if (itemsWithTag.length > 0) {
      await prisma.$transaction(
        itemsWithTag.map((item) =>
          prisma.menuItem.update({
            where: { id: item.id },
            data: { tags: item.tags.filter((t) => t !== tag.key) },
          })
        )
      )
    }

    await prisma.tag.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete tag:", error)
    return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 })
  }
}
