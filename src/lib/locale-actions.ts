'use server';
import { cookies } from 'next/headers';
import { after } from 'next/server';
import { auth } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function setLocale(locale: 'en' | 'zh') {
  // Cookie is the synchronous path — we return as soon as it's written so the
  // client can re-render with the new locale without waiting on session fetch
  // or a DB round-trip.
  const store = await cookies();
  store.set('NEXT_LOCALE', locale, { path: '/', maxAge: 60 * 60 * 24 * 365 });

  // DB persistence (for cross-device preference) runs after the response is
  // committed so the toggle feels instant to the user.
  after(async () => {
    try {
      const session = await auth();
      if (session?.user?.id) {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { preferredLanguage: locale === 'zh' ? 'ZH' : 'EN' },
        });
      }
    } catch {
      // Non-fatal — cookie write already succeeded.
    }
  });
}
