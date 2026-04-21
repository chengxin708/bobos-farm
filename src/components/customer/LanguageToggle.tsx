"use client"

import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { setLocale } from "@/lib/locale-actions"

/**
 * Compact EN ↔ 中 toggle meant for the booking / inquiry top bars, where
 * the full navbar (which has its own dropdown switcher) isn't rendered.
 * Single tap swaps language — no dropdown, since there are only two options.
 */
export function LanguageToggle() {
  const locale = useLocale()
  const tLang = useTranslations("language")
  const router = useRouter()

  async function toggle() {
    const next = locale === "en" ? "zh" : "en"
    await setLocale(next)
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={tLang("switchTo")}
      className="flex items-center gap-1 px-3 py-1 rounded-full border border-[#E8ECE4] bg-white text-sm font-semibold text-[#1A1208] hover:bg-[#E8ECE4] transition-colors cursor-pointer"
    >
      <span className={locale === "en" ? "text-[#6B7F5E]" : "text-[#8C8478]"}>EN</span>
      <span className="text-[#8C8478]">/</span>
      <span className={locale === "zh" ? "text-[#6B7F5E]" : "text-[#8C8478]"}>中</span>
    </button>
  )
}
