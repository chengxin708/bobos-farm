import type { PrismaClient, User } from "@prisma/client"
import { recordContactsFromUser } from "@/lib/contact-history"

function randomCuid(): string {
  return `${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`
}

export interface GuestContact {
  guestName: string
  guestEmail?: string
  guestPhone?: string
  guestWechatId?: string
}

/**
 * Resolve (or create) the customer User to attach an admin-proxy
 * reservation / inquiry to.
 *
 * Matching strategy — mirrors the logic previously inlined in
 * POST /api/reservations so that proxy reservations and proxy
 * inquiries end up on the same customer record:
 *
 *   1. If email is provided, look up by email. May match a real
 *      account or an existing placeholder. Backfill missing phone /
 *      wechat on the match.
 *   2. Otherwise, soft-match against an existing PLACEHOLDER user
 *      (@placeholder.local email) by phone or wechat. We never
 *      soft-match against real accounts on phone/wechat alone —
 *      email is the only authoritative identifier.
 *   3. Otherwise, mint a new placeholder with a temp- prefixed
 *      @placeholder.local email and role=CUSTOMER.
 *
 * Also records the supplied contact values against the customer's
 * contact history so admins can see who entered which details.
 */
export async function resolveAdminProxyCustomer(
  prisma: PrismaClient,
  contact: GuestContact,
  adminUserId: string,
): Promise<User> {
  const guestName = contact.guestName.trim()
  const guestEmail = (contact.guestEmail || "").trim()
  const guestPhone = (contact.guestPhone || "").trim()
  const guestWechatId = (contact.guestWechatId || "").trim()

  let customer: User | null = guestEmail
    ? await prisma.user.findUnique({ where: { email: guestEmail } })
    : null

  if (!customer && (guestPhone || guestWechatId)) {
    customer = await prisma.user.findFirst({
      where: {
        role: "CUSTOMER",
        email: { endsWith: "@placeholder.local" },
        OR: [
          ...(guestPhone ? [{ phone: guestPhone }] : []),
          ...(guestWechatId ? [{ wechatId: guestWechatId }] : []),
        ],
      },
    })
  }

  if (!customer) {
    customer = await prisma.user.create({
      data: {
        email: guestEmail || `temp-${randomCuid()}@placeholder.local`,
        name: guestName,
        phone: guestPhone || null,
        wechatId: guestWechatId || null,
        role: "CUSTOMER",
      },
    })
  } else {
    const updates: { phone?: string; wechatId?: string } = {}
    if (!customer.phone && guestPhone) updates.phone = guestPhone
    if (!customer.wechatId && guestWechatId) updates.wechatId = guestWechatId
    if (Object.keys(updates).length > 0) {
      customer = await prisma.user.update({ where: { id: customer.id }, data: updates })
    }
  }

  await recordContactsFromUser(
    prisma,
    {
      id: customer.id,
      email: guestEmail || null,
      phone: guestPhone || null,
      wechatId: guestWechatId || null,
    },
    "admin",
    adminUserId,
  )

  return customer
}
