'use server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function setLocale(locale: 'en' | 'zh') {
  // Always set the cookie first (works for anonymous and logged-in users)
  const store = await cookies();
  store.set('NEXT_LOCALE', locale, { path: '/', maxAge: 60 * 60 * 24 * 365 });

  // For logged-in users, also persist to DB (DB preference takes priority on next load)
  try {
    const session = await auth();
    if (session?.user?.id) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { preferredLanguage: locale === 'zh' ? 'ZH' : 'EN' },
      });
    }
  } catch {
    // DB update failure is non-fatal — cookie is already set for graceful degradation
  }
}
