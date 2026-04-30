"use client"

import { useTranslations } from "next-intl"
import type { OperatingDayMode } from "@/lib/operating-day-pure"

interface Props {
  date: string // YYYY-MM-DD (ET key)
  isWeekend: boolean
  currentMode: OperatingDayMode
  hasRow: boolean
  rowId?: string
  onClose: () => void
  onSubmit: (action: 'set' | 'clear', mode?: OperatingDayMode) => Promise<void>
}

export default function OperatingDayActionsMenu({
  date, isWeekend, currentMode, hasRow, onClose, onSubmit,
}: Props) {
  const t = useTranslations("admin.calendar.operatingDay")

  const buttonClass =
    "w-full text-left px-4 py-2.5 text-sm bg-white hover:bg-[#F2EDE6] cursor-pointer border-0"

  const actions: { label: string; run: () => void }[] = []

  if (!isWeekend) {
    if (currentMode === 'CLOSED') {
      actions.push({ label: t('markOpen'), run: () => onSubmit('set', 'OPEN') })
      actions.push({ label: t('enablePrivateEvent'), run: () => onSubmit('set', 'PRIVATE_EVENT') })
    } else if (currentMode === 'OPEN') {
      actions.push({ label: t('convertToPrivateEvent'), run: () => onSubmit('set', 'PRIVATE_EVENT') })
      actions.push({ label: t('markClosed'), run: () => onSubmit(hasRow ? 'clear' : 'set', hasRow ? undefined : 'CLOSED') })
    } else if (currentMode === 'PRIVATE_EVENT') {
      actions.push({ label: t('makePublicOpen'), run: () => onSubmit('set', 'OPEN') })
      actions.push({ label: t('markClosed'), run: () => onSubmit(hasRow ? 'clear' : 'set', hasRow ? undefined : 'CLOSED') })
    }
  } else {
    if (currentMode === 'OPEN' && !hasRow) {
      actions.push({ label: t('markClosed'), run: () => onSubmit('set', 'CLOSED') })
    } else {
      actions.push({ label: t('restoreDefault'), run: () => onSubmit('clear') })
      if (currentMode !== 'CLOSED') actions.push({ label: t('markClosed'), run: () => onSubmit('set', 'CLOSED') })
      if (currentMode !== 'PRIVATE_EVENT') actions.push({ label: t('convertToPrivateEvent'), run: () => onSubmit('set', 'PRIVATE_EVENT') })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg min-w-[260px] py-1 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-2 border-b border-[#E8ECE4]">
          <p className="text-xs text-[#8C8478]">{date}</p>
        </div>
        {actions.map((a, i) => (
          <button key={i} className={buttonClass} onClick={() => { a.run(); onClose(); }}>
            {a.label}
          </button>
        ))}
        <button className={`${buttonClass} text-[#8C8478]`} onClick={onClose}>
          {t('cancel')}
        </button>
      </div>
    </div>
  )
}
