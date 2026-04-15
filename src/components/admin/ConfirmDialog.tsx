'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, CheckCircle, XCircle, X } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'confirm' | 'danger' | 'success'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const variantConfig = {
  confirm: {
    icon: CheckCircle,
    iconBg: 'bg-[#6B7F5E]/10',
    iconColor: 'text-[#6B7F5E]',
    btnBg: 'bg-[#6B7F5E] hover:bg-[#5A6E4F]',
  },
  danger: {
    icon: AlertTriangle,
    iconBg: 'bg-[#DC3545]/10',
    iconColor: 'text-[#DC3545]',
    btnBg: 'bg-[#DC3545] hover:bg-[#C82333]',
  },
  success: {
    icon: CheckCircle,
    iconBg: 'bg-[#5B8C3E]/10',
    iconColor: 'text-[#5B8C3E]',
    btnBg: 'bg-[#5B8C3E] hover:bg-[#4A7C30]',
  },
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'confirm',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const tc = useTranslations('admin.common')
  const resolvedConfirmLabel = confirmLabel ?? tc('confirm')
  const resolvedCancelLabel = cancelLabel ?? tc('cancel')
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const config = variantConfig[variant]
  const Icon = config.icon

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => { if (e.target === overlayRef.current) onCancel() }}
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${config.iconBg} flex items-center justify-center shrink-0`}>
              <Icon size={20} className={config.iconColor} />
            </div>
            <h3 className="text-base font-semibold text-[#1A1208]">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg hover:bg-[#E8ECE4] transition-colors border-0 bg-transparent cursor-pointer"
          >
            <X size={16} className="text-[#8C8478]" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-sm text-[#8C8478] leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 text-sm font-medium text-[#1A1208] bg-transparent border border-[#E8ECE4] rounded-xl cursor-pointer hover:bg-[#F8F7F4] transition-colors disabled:opacity-50"
          >
            {resolvedCancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 text-sm font-medium text-white border-0 rounded-xl cursor-pointer transition-colors disabled:opacity-50 ${config.btnBg}`}
          >
            {loading ? '...' : resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
