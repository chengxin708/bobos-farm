"use client"

import { useState } from 'react'
import { Calendar, Tent, Users, MessageSquare, Upload, Copy, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function BookingConfirmPage() {
  const t = useTranslations('booking.confirm')
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const summaryRows = [
    { icon: Calendar, labelKey: 'date' as const, value: 'Saturday, March 15, 2026' },
    { icon: Tent, labelKey: 'yurt' as const, value: 'Golden Meadow (up to 15 guests)' },
    { icon: Users, labelKey: 'guests' as const, value: '12' },
    { icon: MessageSquare, labelKey: 'specialRequests' as const, value: 'No shellfish allergy' },
  ]

  const paymentSteps = [
    { num: 1, textKey: 'step1' as const },
    { num: 2, textKey: 'step2' as const, highlight: 'jenny@bobosfarm.com' },
    { num: 3, textKey: 'step3' as const, highlight: 'BOBO-20260315-JOHN' },
  ]

  return (
    <>
      {/* Content */}
      <div className="flex-1 flex flex-col items-center py-6 px-4 sm:px-10 lg:px-20 gap-6 overflow-y-auto">
        {/* Reservation Summary */}
        <div className="w-[600px] bg-[#FEFCF3] rounded-2xl p-6 border-[1.5px] border-beige flex flex-col gap-5">
          <h3 className="font-playfair text-xl font-bold text-brown">{t('summaryTitle')}</h3>
          <div className="h-px bg-beige" />
          <div className="flex flex-col gap-4">
            {summaryRows.map((row) => (
              <div key={row.labelKey} className="flex items-start gap-3">
                <row.icon size={18} className="text-amber mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-brown/53">{t(`summaryLabels.${row.labelKey}`)}</div>
                  <div className="text-sm font-medium text-brown">{row.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Card */}
        <div className="w-[600px] bg-white rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)] flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h3 className="font-playfair text-xl font-bold text-brown">{t('depositRequired')}</h3>
            <span className="font-playfair text-3xl font-bold text-amber">$300</span>
          </div>
          <div className="h-px bg-beige" />

          <p className="text-base font-bold text-brown">{t('howToPay')}</p>

          <div className="flex flex-col gap-4.5">
            {paymentSteps.map((step) => (
              <div key={step.num} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-amber text-white text-sm font-bold flex items-center justify-center shrink-0">
                  {step.num}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-brown">{t(step.textKey)}</span>
                  {step.highlight && (
                    <div className="flex items-center gap-2 bg-amber-light rounded-lg px-3 py-1.5">
                      <span className="text-sm font-semibold text-amber">{step.highlight}</span>
                      <Copy size={14} className="text-amber cursor-pointer" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Countdown */}
          <div className="bg-[#F4A623] rounded-lg px-4 py-3.5 flex flex-col items-center gap-1">
            <span className="text-sm font-bold text-white">&#x23f0; {t('countdown', { time: '12:00:00' })}</span>
            <span className="text-xs text-white/80">{t('countdownSub')}</span>
          </div>

          {/* Upload Area */}
          <div className="h-[180px] border-[1.5px] border-dashed border-beige rounded-xl flex flex-col items-center justify-center gap-2">
            <Upload size={32} className="text-beige" />
            <span className="text-sm text-brown/53">{t('uploadTitle')}</span>
            <span className="text-[13px] text-amber font-semibold cursor-pointer">{t('uploadBrowse')}</span>
            <span className="text-[11px] text-brown/33">{t('uploadFormats')}</span>
          </div>

          {/* Checkbox */}
          <label className="flex gap-3 cursor-pointer select-none">
            <button
              type="button"
              onClick={() => setAcceptedTerms(!acceptedTerms)}
              className={`w-[18px] h-[18px] rounded border-[1.5px] shrink-0 mt-0.5 flex items-center justify-center cursor-pointer ${
                acceptedTerms ? 'bg-amber border-amber' : 'border-beige bg-white'
              }`}
            >
              {acceptedTerms && <Check size={12} className="text-white" />}
            </button>
            <span className="text-xs text-brown/53 leading-relaxed">
              {t('cancellationPolicy')}
            </span>
          </label>

          {/* Submit Button */}
          <button
            disabled={!acceptedTerms}
            className={`h-[52px] rounded-2xl text-white text-base font-semibold border-none w-full transition-colors ${
              acceptedTerms
                ? 'bg-gradient-to-r from-amber to-[#A67C2E] cursor-pointer shadow-[0_4px_16px_rgba(139,105,20,0.2)]'
                : 'bg-[#BFBFBF] cursor-not-allowed'
            }`}
          >
            {t('completedTransfer')}
          </button>

          <p className="text-[13px] text-[#8E8E93] text-center">{t('cancelReservation')}</p>
        </div>
      </div>
    </>
  )
}
