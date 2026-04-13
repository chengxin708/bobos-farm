import webpush from "web-push";
import { prisma } from "./prisma";

// Lazy-init VAPID — only configure when keys are available
let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn("[Push] VAPID keys not configured — push notifications disabled");
    return false;
  }
  webpush.setVapidDetails("mailto:admin@bobosfarm.com", publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string; // URL to navigate to when notification is clicked
  icon?: string;
  tag?: string; // Collapse tag for replacing existing notifications
}

/**
 * Send a push notification to all subscriptions belonging to a specific user.
 * Automatically cleans up expired/invalid subscriptions (410 Gone, 404).
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!ensureVapid()) return [];

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) return [];

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        // Subscription is no longer valid - clean it up
        if (statusCode === 410 || statusCode === 404) {
          await prisma.pushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => {});
        }
        throw err;
      }
    })
  );

  return results;
}

/**
 * Send a push notification to all ADMIN users.
 */
export async function sendPushToAdmins(payload: PushPayload) {
  const adminUsers = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  await Promise.allSettled(
    adminUsers.map((u) => sendPushToUser(u.id, payload))
  );
}
