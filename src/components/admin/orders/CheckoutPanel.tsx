'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Check, Loader2, Printer } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────

interface CheckoutPanelProps {
  reservation: {
    id: string
    depositAmount: number
    depositStatus: string
    user: { name: string | null; email: string }
    yurt: { name: string } | null
    date: string
    guestCount: number
  }
  order: {
    id: string
    status: string
    estimatedTotal: number | null
    finalTotal?: number | null
    discount?: number | null
    paymentMethod?: string | null
    paidAt?: string | null
    items: Array<{
      id: string
      quantity: number
      specialNotes: string | null
      menuItem: { nameEn: string; nameZh: string | null; price: number }
    }>
  }
  isOpen: boolean
  onClose: () => void
  onCompleted: () => void
}

// ── Helpers ────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const DEFAULT_PAYMENT_METHODS = ['Zelle', 'Cash']

// ── Component ──────────────────────────────────────────────────────

export default function CheckoutPanel({
  reservation,
  order,
  isOpen,
  onClose,
  onCompleted,
}: CheckoutPanelProps) {
  const t = useTranslations('admin.orders')
  const [discount, setDiscount] = useState<number>(order.discount ?? 0)
  const [paymentMethod, setPaymentMethod] = useState<string>(order.paymentMethod ?? '')
  const [paymentMethods, setPaymentMethods] = useState<string[]>(DEFAULT_PAYMENT_METHODS)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Fetch payment methods from API
  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    fetch('/api/settings/payment-methods')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch')
        return res.json()
      })
      .then((data: string[]) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setPaymentMethods(data)
        }
      })
      .catch(() => {
        if (!cancelled) setPaymentMethods(DEFAULT_PAYMENT_METHODS)
      })

    return () => { cancelled = true }
  }, [isOpen])

  // Reset state when panel opens with new order
  useEffect(() => {
    if (isOpen) {
      setDiscount(order.discount ?? 0)
      setPaymentMethod(order.paymentMethod ?? '')
      setError('')
      setSubmitting(false)
    }
  }, [isOpen, order.id, order.discount, order.paymentMethod])

  // Escape key to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  // ── Computed values ──

  const subtotal = (order.items || []).reduce(
    (sum, item) => sum + (item.menuItem?.price ?? 0) * item.quantity,
    0,
  )
  const safeDiscount = Math.max(0, Math.min(discount, subtotal))
  const totalDue = subtotal - safeDiscount
  const depositCredit =
    reservation.depositStatus === 'CONFIRMED' ? reservation.depositAmount : 0
  const amountToPay = Math.max(0, totalDue - depositCredit)

  const isPaid = order.status === 'PAID' || !!order.paidAt
  const isBilled = order.status === 'BILLED'

  // ── Handlers ──

  const handleConfirmCheckout = async () => {
    if (!paymentMethod) return
    setError('')
    setSubmitting(true)

    try {
      // Step 1: Bill the order first if not already billed
      if (order.status !== 'BILLED') {
        const billRes = await fetch(`/api/orders/${order.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'bill',
            discount: safeDiscount,
          }),
        })

        if (!billRes.ok) {
          const data = await billRes.json().catch(() => ({}))
          setError(data.error || t('billError'))
          setSubmitting(false)
          return
        }
      }

      // Step 2: Mark as paid
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pay',
          paymentMethod,
          discount: safeDiscount,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || t('checkoutError'))
        setSubmitting(false)
        return
      }

      onCompleted()
    } catch {
      setError(t('networkError'))
      setSubmitting(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  // ── Render ──

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-[#F8F7F4] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E8ECE4]">
        <button
          onClick={onClose}
          className="p-1 hover:bg-[#E8ECE4]/40 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-[#8C8478]" />
        </button>
        <h2
          className="text-lg font-bold text-[#1A1208]"
          style={{ fontFamily: 'var(--font-playfair)' }}
        >
          {t('checkout')}
        </h2>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 pb-28">
        {/* Already paid state */}
        {isPaid ? (
          <PaidSummary
            order={order}
            subtotal={subtotal}
            depositCredit={depositCredit}
            onPrint={handlePrint}
          />
        ) : (
          <>
            {/* Reservation info */}
            <div className="mb-5">
              <p className="text-sm text-[#8C8478] leading-relaxed">
                <span className="font-medium text-[#1A1208]">
                  {reservation.user.name || reservation.user.email}
                </span>
                {' · '}
                {reservation.yurt?.name ?? 'Pending'}
                {' · '}
                {formatDate(reservation.date)}
                {' · '}
                {t('guests', { count: reservation.guestCount })}
              </p>
            </div>

            {/* Order items */}
            <section className="mb-5">
              <SectionHeading>{t('orderDetails')}</SectionHeading>
              <div className="space-y-2 mt-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-baseline justify-between">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-[#1A1208]">
                        {item.menuItem.nameZh || item.menuItem.nameEn}
                      </span>
                      {item.specialNotes && (
                        <span className="text-xs text-[#8C8478] ml-1.5">
                          ({item.specialNotes})
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-3 ml-3 shrink-0">
                      <span className="text-xs text-[#8C8478]">
                        x{item.quantity}
                      </span>
                      <span className="text-sm text-[#1A1208] font-[tabular-nums] w-20 text-right">
                        {formatCurrency(item.menuItem.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Bill section */}
            <section className="mb-5">
              <SectionHeading>{t('bill')}</SectionHeading>
              <div className="mt-3 space-y-2.5">
                {/* Subtotal */}
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-[#8C8478]">{t('subtotalLabel')}</span>
                  <span className="text-sm text-[#1A1208] font-[tabular-nums]">
                    {formatCurrency(subtotal)}
                  </span>
                </div>

                {/* Discount */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#8C8478]">{t('discount')}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#8C8478]">-$</span>
                    <input
                      type="number"
                      min={0}
                      max={subtotal}
                      step={0.01}
                      value={discount || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value)
                        setDiscount(isNaN(val) ? 0 : val)
                      }}
                      disabled={isBilled}
                      placeholder="0"
                      className="w-20 h-8 px-2 text-right text-sm font-[tabular-nums] rounded-lg border border-[#E8ECE4] bg-white text-[#1A1208] outline-none focus:border-[#6B7F5E] focus:ring-1 focus:ring-[#6B7F5E]/30 disabled:opacity-50 disabled:bg-[#F5F2ED]"
                    />
                  </div>
                </div>

                <hr className="border-[#E8ECE4]" />

                {/* Total due */}
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-[#1A1208]">{t('amountDue')}</span>
                  <span className="text-sm font-semibold text-[#1A1208] font-[tabular-nums]">
                    {formatCurrency(totalDue)}
                  </span>
                </div>

                {/* Deposit credit */}
                {depositCredit > 0 && (
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-[#8C8478]">{t('depositPaid')}</span>
                    <span className="text-sm text-[#5B8C3E] font-[tabular-nums]">
                      -{formatCurrency(depositCredit)}
                    </span>
                  </div>
                )}

                {depositCredit > 0 && <hr className="border-[#E8ECE4]" />}

                {/* Amount to pay */}
                <div className="flex justify-between items-baseline pt-1">
                  <span className="text-base font-bold text-[#1A1208]">{t('balanceDue')}</span>
                  <span className="text-2xl font-bold text-[#1A1208] font-[tabular-nums]">
                    {formatCurrency(amountToPay)}
                  </span>
                </div>
              </div>
            </section>

            {/* Payment method */}
            <section className="mb-5">
              <SectionHeading>{t('paymentMethod')}</SectionHeading>
              <div className="flex flex-wrap gap-2.5 mt-3">
                {paymentMethods.map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    disabled={isBilled && order.paymentMethod !== method}
                    className={`px-5 py-2 text-sm font-medium rounded-full transition-all duration-150 ${
                      paymentMethod === method
                        ? 'bg-[#6B7F5E] text-white shadow-sm'
                        : 'border border-[#E8ECE4] text-[#1A1208] hover:border-[#6B7F5E]/40 hover:bg-[#6B7F5E]/5'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </section>

            {/* Billed waiting state */}
            {isBilled && (
              <div className="rounded-lg bg-[#F4A623]/10 border border-[#F4A623]/20 px-4 py-3 mb-3">
                <p className="text-sm text-[#8B6914] font-medium">
                  {t('billGenerated')}
                </p>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="rounded-lg bg-[#DC3545]/5 border border-[#DC3545]/20 px-4 py-3 mb-3">
                <p className="text-sm text-[#DC3545]">{error}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Fixed bottom button */}
      {!isPaid && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#F8F7F4] border-t border-[#E8ECE4] px-5 py-4">
          <button
            onClick={handleConfirmCheckout}
            disabled={!paymentMethod || submitting}
            className="w-full py-3 text-base font-medium text-white rounded-full bg-[#6B7F5E] hover:bg-[#5A6E4F] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {t('processing')}
              </>
            ) : (
              t('confirmCheckout')
            )}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-[#8C8478] uppercase tracking-wider">
        {children}
      </span>
      <div className="flex-1 h-px bg-[#E8ECE4]" />
    </div>
  )
}

function PaidSummary({
  order,
  subtotal,
  depositCredit,
  onPrint,
}: {
  order: CheckoutPanelProps['order']
  subtotal: number
  depositCredit: number
  onPrint: () => void
}) {
  const t = useTranslations('admin.orders')
  const discount = order.discount ?? 0
  const totalDue = subtotal - discount
  const amountPaid = order.finalTotal ?? Math.max(0, totalDue - depositCredit)

  return (
    <div className="flex flex-col items-center">
      {/* Success icon */}
      <div className="w-16 h-16 rounded-full bg-[#5B8C3E]/15 flex items-center justify-center mb-4">
        <Check size={32} className="text-[#5B8C3E]" />
      </div>
      <h3
        className="text-xl font-bold text-[#1A1208] mb-1"
        style={{ fontFamily: 'var(--font-playfair)' }}
      >
        {t('paid')}
      </h3>
      <p className="text-sm text-[#8C8478] mb-6">{t('paidDesc')}</p>

      {/* Payment details card */}
      <div className="w-full rounded-xl border border-[#E8ECE4] bg-white p-5 space-y-3">
        <DetailRow label={t('paidAt')} value={order.paidAt ? formatDateTime(order.paidAt) : '-'} />
        <DetailRow label={t('paymentMethod')} value={order.paymentMethod ?? '-'} />
        <DetailRow
          label={t('paidAmount')}
          value={formatCurrency(amountPaid)}
          bold
        />
        {discount > 0 && (
          <DetailRow label={t('discount')} value={`-${formatCurrency(discount)}`} />
        )}
        {depositCredit > 0 && (
          <DetailRow label={t('depositPaid')} value={`-${formatCurrency(depositCredit)}`} />
        )}
      </div>

      {/* Print button */}
      <button
        onClick={onPrint}
        className="mt-6 flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-[#1A1208] rounded-full border border-[#E8ECE4] hover:bg-[#E8ECE4]/30 transition-colors"
      >
        <Printer size={16} className="text-[#8C8478]" />
        {t('printReceipt')}
      </button>
    </div>
  )
}

function DetailRow({
  label,
  value,
  bold,
}: {
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-sm text-[#8C8478]">{label}</span>
      <span
        className={`text-sm font-[tabular-nums] ${
          bold ? 'font-bold text-[#1A1208]' : 'text-[#1A1208]'
        }`}
      >
        {value}
      </span>
    </div>
  )
}
