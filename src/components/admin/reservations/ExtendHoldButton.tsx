'use client'

import { useEffect, useState } from 'react'
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
  // Shadow the prop so the label updates immediately from the API
  // response without waiting for the parent to re-fetch activity logs.
  // The effect keeps it monotonically caught up when the parent
  // eventually does refresh with a higher count.
  const [localCount, setLocalCount] = useState(extendCount)
  useEffect(() => {
    setLocalCount((n) => (extendCount > n ? extendCount : n))
  }, [extendCount])
  const displayCount = localCount
  const warnMany = displayCount >= 3

  const handleClick = async () => {
    setPending(true)
    try {
      const res = await fetch(`/api/reservations/${reservationId}/extend-hold`, {
        method: 'POST',
      })
      if (res.ok) {
        const body = await res.json().catch(() => ({}))
        if (typeof body.extendCount === 'number') setLocalCount(body.extendCount)
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
      {displayCount > 0 && (
        <span className={`text-[11px] ${warnMany ? 'text-[#E67E22]' : 'text-[#8A7E6B]'}`}>
          {warnMany
            ? t('extendHoldWarn3')
            : t('extendHoldCount', { count: displayCount })}
        </span>
      )}
    </div>
  )
}
