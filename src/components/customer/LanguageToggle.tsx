"use client"

import { useOptimistic, useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { setLocale } from "@/lib/locale-actions"

/**
 * Compact EN ↔ 中 toggle meant for the booking / inquiry top bars, where
 * the full navbar (which has its own dropdown switcher) isn't rendered.
 * Single tap swaps language — no dropdown, since there are only two options.
 *
 * The visible highlight flips optimistically so the button feels instant even
 * while the server action + router.refresh are still in flight; a subtle
 * opacity dip during the transition signals that new translations are loading.
 */
export function LanguageToggle() {
  const locale = useLocale()
  const tLang = useTranslations("language")
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic<'en' | 'zh', 'en' | 'zh'>(
    locale as 'en' | 'zh',
    (_state, next) => next,
  )

  function toggle() {
    const next = optimistic === "en" ? "zh" : "en"
    startTransition(async () => {
      setOptimistic(next)
      await setLocale(next)
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label={tLang("switchTo")}
      aria-busy={isPending}
      className={`flex items-center gap-1 px-3 py-1 rounded-full border border-[#E8ECE4] bg-white text-sm font-semibold text-[#1A1208] hover:bg-[#E8ECE4] cursor-pointer transition-opacity ${
        isPending ? 'opacity-60' : 'opacity-100'
      }`}
    >
      <span className={optimistic === "en" ? "text-[#6B7F5E]" : "text-[#8C8478]"}>EN</span>
      <span className="text-[#8C8478]">/</span>
      <span className={optimistic === "zh" ? "text-[#6B7F5E]" : "text-[#8C8478]"}>中</span>
    </button>
  )
}
