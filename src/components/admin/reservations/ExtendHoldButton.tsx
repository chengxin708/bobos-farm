'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Clock, Loader2 } from 'lucide-react'

interface ExtendHoldButtonProps {
  reservationId: string
  extendCount: number
  disabled?: boolean
  onExtended: () => void
  onToast: (msg: { ok: boolean; msg: string }) => void
}

export default function ExtendHoldButton({
  reservationId,
  extendCount,
  disabled,
  onExtended,
  onToast,
}: ExtendHoldButtonProps) {
  const t = useTranslations('admin.reservations.actions')
  const [pending, setPending] = useState(false)
  const warnMany = extendCount >= 3

  const handleClick = async () => {
    setPending(true)
    try {
      const res = await fetch(`/api/reservations/${reservationId}/extend-hold`, {
        method: 'POST',
      })
      if (res.ok) {
        onExtended()
        onToast({ ok: true, msg: t('extendHoldSuccess') })
      } else {
        onToast({ ok: false, msg: t('extendHoldFailed') })
      }
    } catch {
      onToast({ ok: false, msg: t('extendHoldFailed') })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-1 w-full">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || pending}
        className="w-full py-2 text-sm font-semibold rounded-lg border border-[#6B7F5E] text-[#6B7F5E] hover:bg-[#6B7F5E]/5 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
        {t('extendHold')}
      </button>
      {extendCount > 0 && (
        <span className={`text-[11px] ${warnMany ? 'text-[#E67E22]' : 'text-[#8A7E6B]'}`}>
          {warnMany
            ? t('extendHoldWarn3')
            : t('extendHoldCount', { count: extendCount })}
        </span>
      )}
    </div>
  )
}
