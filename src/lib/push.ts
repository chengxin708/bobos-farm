import webpush from "web-push";
import { prisma } from "./prisma";

// Configure VAPID credentials for Web Push
webpush.setVapidDetails(
  "mailto:admin@bobosfarm.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

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
