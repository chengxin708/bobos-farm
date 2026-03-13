import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { getToken } from 'next-auth/jwt';

const validLocales = ['en', 'zh'];

export default getRequestConfig(async () => {
  let resolvedLocale = 'en';

  // Step 1: Try to read JWT token — logged-in user's DB preference takes priority
  try {
    const headerStore = await headers();
    const headerEntries = Object.fromEntries(headerStore.entries());

    // Construct a minimal request-like object for getToken
    const token = await getToken({
      req: { headers: headerEntries } as Parameters<typeof getToken>[0]['req'],
      secret: process.env.AUTH_SECRET,
      secureCookie: false,
    });

    if (token?.preferredLanguage) {
      const dbLocale = (token.preferredLanguage as string) === 'ZH' ? 'zh' : 'en';
      resolvedLocale = dbLocale;

      // Sync cookie to match DB preference so subsequent requests stay consistent
      try {
        const cookieStore = await cookies();
        cookieStore.set('NEXT_LOCALE', dbLocale, { path: '/', maxAge: 60 * 60 * 24 * 365 });
      } catch {
        // Cookie setting may fail in some server contexts (e.g., during static rendering) — ignore
      }

      return {
        locale: resolvedLocale,
        messages: (await import(`../../messages/${resolvedLocale}.json`)).default,
      };
    }
  } catch {
    // getToken may fail during build, SSG, or edge cases — fall back gracefully to cookie
  }

  // Step 2: Anonymous user — read NEXT_LOCALE cookie, default to 'en'
  try {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value ?? 'en';
    resolvedLocale = validLocales.includes(cookieLocale) ? cookieLocale : 'en';
  } catch {
    // Cookie reading failure — default to 'en'
    resolvedLocale = 'en';
  }

  return {
    locale: resolvedLocale,
    messages: (await import(`../../messages/${resolvedLocale}.json`)).default,
  };
});
