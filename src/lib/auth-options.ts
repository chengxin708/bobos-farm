import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await compare(password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          preferredLanguage: user.preferredLanguage,
        };
      },
    }),
    // Google OAuth - only enabled when env vars are set
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign-in: populate token from user
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = user.id;
        token.preferredLanguage = (user as { preferredLanguage?: string }).preferredLanguage ?? "EN";
      }

      // For Google OAuth, we set user data in signIn callback
      // but jwt callback fires with the Google profile — need to fetch our DB user
      if (account?.provider === "google" && !token.role) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email! },
          select: { id: true, role: true, preferredLanguage: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.preferredLanguage = dbUser.preferredLanguage;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role: string }).role = token.role as string;
        (session.user as { preferredLanguage: string }).preferredLanguage =
          (token.preferredLanguage as string) ?? "EN";
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // Only handle Google OAuth
      if (account?.provider !== "google" || !user.email) {
        return true;
      }

      const email = user.email;
      const googleAccountId = account.providerAccountId;

      // Check if this Google account is already linked
      const existingAccount = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: googleAccountId,
          },
        },
        include: { user: true },
      });

      if (existingAccount) {
        // Already linked — update tokens and sign in
        await prisma.account.update({
          where: { id: existingAccount.id },
          data: {
            accessToken: account.access_token ?? null,
            refreshToken: account.refresh_token ?? null,
            expiresAt: account.expires_at ?? null,
          },
        });

        // Update user profile from Google if needed
        await prisma.user.update({
          where: { id: existingAccount.userId },
          data: {
            image: user.image ?? existingAccount.user.image,
            emailVerified: existingAccount.user.emailVerified ?? new Date(),
          },
        });

        // Set the user id so jwt callback picks it up
        user.id = existingAccount.userId;
        (user as { role: string }).role = existingAccount.user.role;
        (user as { preferredLanguage: string }).preferredLanguage = existingAccount.user.preferredLanguage;
        return true;
      }

      // Check if a user with this email already exists (credentials account)
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        // Link Google to existing user
        await prisma.account.create({
          data: {
            userId: existingUser.id,
            provider: "google",
            providerAccountId: googleAccountId,
            type: "oauth",
            accessToken: account.access_token ?? null,
            refreshToken: account.refresh_token ?? null,
            expiresAt: account.expires_at ?? null,
            tokenType: account.token_type ?? null,
            scope: account.scope ?? null,
          },
        });

        // Update user with Google profile data
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            image: user.image ?? existingUser.image,
            name: existingUser.name || user.name, // Don't overwrite existing name
            emailVerified: existingUser.emailVerified ?? new Date(),
          },
        });

        user.id = existingUser.id;
        (user as { role: string }).role = existingUser.role;
        (user as { preferredLanguage: string }).preferredLanguage = existingUser.preferredLanguage;
        return true;
      }

      // No existing user — create new user + account
      const newUser = await prisma.user.create({
        data: {
          email,
          name: user.name,
          image: user.image,
          emailVerified: new Date(),
          role: "CUSTOMER",
          preferredLanguage: "EN",
          marketingOptIn: true,
          unsubscribeToken: crypto.randomUUID(),
        },
      });

      await prisma.account.create({
        data: {
          userId: newUser.id,
          provider: "google",
          providerAccountId: googleAccountId,
          type: "oauth",
          accessToken: account.access_token ?? null,
          refreshToken: account.refresh_token ?? null,
          expiresAt: account.expires_at ?? null,
          tokenType: account.token_type ?? null,
          scope: account.scope ?? null,
        },
      });

      user.id = newUser.id;
      (user as { role: string }).role = newUser.role;
      (user as { preferredLanguage: string }).preferredLanguage = newUser.preferredLanguage;
      return true;
    },
  },
  session: {
    strategy: "jwt",
  },
});
