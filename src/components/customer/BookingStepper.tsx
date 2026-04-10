'use client'

import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface BookingStepperProps {
  currentStep: number
}

export default function BookingStepper({ currentStep }: BookingStepperProps) {
  const t = useTranslations('booking.stepper')

  const steps = [
    t('chooseDate'),
    t('selectYurt'),
    t('details'),
    t('confirmPay'),
  ]

  return (
    <div className="w-full bg-white shadow-sm py-4 sm:py-6 lg:py-8 px-4 sm:px-10 lg:px-20 flex justify-center">
      <div className="flex items-center">
        {steps.map((label, i) => {
          const step = i + 1
          const isCompleted = step < currentStep
          const isCurrent = step === currentStep
          return (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center gap-2.5">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                    isCompleted ? 'bg-green border-green text-white'
                      : isCurrent ? 'bg-amber border-amber text-white'
                      : 'bg-white border-beige text-beige'
                  }`}>
                  {isCompleted ? <Check size={18} /> : step}
                </div>
                <span className={`text-xs font-medium ${
                    isCurrent ? 'text-brown font-semibold' : isCompleted ? 'text-green' : 'text-[#8E8E93]'
                  }`}>{label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className="flex items-center px-2 sm:px-4 pb-6">
                  <div className={`w-24 border-t-2 ${step < currentStep ? 'border-green' : 'border-dashed border-beige'}`} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
