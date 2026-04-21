'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Unlock, Loader2 } from 'lucide-react'
import ConfirmDialog from '@/components/admin/ConfirmDialog'

interface ReleaseHoldButtonProps {
  reservationId: string
  disabled?: boolean
  onReleased: () => void
  onToast: (msg: { ok: boolean; msg: string }) => void
}

export default function ReleaseHoldButton({
  reservationId,
  disabled,
  onReleased,
  onToast,
}: ReleaseHoldButtonProps) {
  const t = useTranslations('admin.reservations.actions')
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)

  const release = async () => {
    setPending(true)
    try {
      const res = await fetch(`/api/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'release_hold' }),
      })
      if (res.ok) {
        onReleased()
        onToast({ ok: true, msg: t('releaseHoldSuccess') })
      } else {
        onToast({ ok: false, msg: t('releaseHoldFailed') })
      }
    } catch {
      onToast({ ok: false, msg: t('releaseHoldFailed') })
    } finally {
      setPending(false)
      setConfirming(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={disabled || pending}
        className="w-full py-2 text-sm font-semibold rounded-lg border border-[#8B6914] text-[#8B6914] hover:bg-[#8B6914]/5 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
        {t('releaseHold')}
      </button>
      {confirming && (
        <ConfirmDialog
          isOpen
          title={t('releaseHold')}
          // Prefix the body with a clearly flagged "no email will be
          // sent" line so admins understand this is silent — the
          // placeholder-email case is the common one and the usual
          // Cancel email is wrong for them.
          message={`⚠ ${t('releaseHoldSilentNotice')}\n\n${t('releaseHoldConfirm')}`}
          variant="danger"
          confirmLabel={t('releaseHold')}
          loading={pending}
          onConfirm={release}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}
