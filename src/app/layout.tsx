import type { Metadata } from "next";
import { Libre_Baskerville, Source_Sans_3, Noto_Serif_SC, Noto_Sans_SC } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import Providers from '@/components/Providers';
import "./globals.css";

const libreBaskerville = Libre_Baskerville({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const sourceSans = Source_Sans_3({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const notoSerifSC = Noto_Serif_SC({
  variable: "--font-noto-serif-sc",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bobo's Farm — 波姐农家乐",
  description:
    "Whole roasted lamb in a yurt — the Hudson Valley's most unique dining experience. By appointment only.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body
        className={`${libreBaskerville.variable} ${sourceSans.variable} ${notoSerifSC.variable} ${notoSansSC.variable} antialiased`}
      >
        <Providers>
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}
