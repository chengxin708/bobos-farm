'use client'

const RESERVATION_STATUS = {
  PENDING_PAYMENT:   { bg: 'bg-[#E67E22]/15', text: 'text-[#E67E22]' },
  PAYMENT_SUBMITTED: { bg: 'bg-[#E67E22]/20', text: 'text-[#E67E22]' },
  CONFIRMED:         { bg: 'bg-[#2980B9]/15', text: 'text-[#2980B9]' },
  COMPLETED:         { bg: 'bg-[#5B8C3E]/15', text: 'text-[#5B8C3E]' },
  CANCELLED:         { bg: 'bg-[#DC3545]/15', text: 'text-[#DC3545]' },
  CANCELLED_PENDING_REFUND: { bg: 'bg-[#DC3545]/15', text: 'text-[#DC3545]' },
  EXPIRED:           { bg: 'bg-[#8C8478]/10', text: 'text-[#8C8478]' },
} as const

const DEPOSIT_STATUS = {
  UNPAID:    { bg: 'bg-[#8C8478]/10', text: 'text-[#8C8478]' },
  PENDING:   { bg: 'bg-[#E67E22]/15', text: 'text-[#E67E22]' },
  CONFIRMED: { bg: 'bg-[#5B8C3E]/15', text: 'text-[#5B8C3E]' },
  REFUNDED:  { bg: 'bg-[#2980B9]/15', text: 'text-[#2980B9]' },
} as const

interface StatusBadgeProps {
  type: 'reservation' | 'deposit'
  status: string
  label: string
}

export default function StatusBadge({ type, status, label }: StatusBadgeProps) {
  const map = type === 'reservation' ? RESERVATION_STATUS : DEPOSIT_STATUS
  const style = map[status as keyof typeof map] ?? { bg: 'bg-gray-100', text: 'text-gray-500' }
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${style.bg} ${style.text}`}>
      {label}
    </span>
  )
}
