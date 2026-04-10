'use client'

import { Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface BookingStepperProps {
  currentStep: number
}

const STEP_PATHS = [
  '/booking/date',
  '/booking/yurt',
  '/booking/details',
  '/booking/confirm',
]

export default function BookingStepper({ currentStep }: BookingStepperProps) {
  const t = useTranslations('booking.stepper')
  const router = useRouter()

  const steps = [
    t('chooseDate'),
    t('selectYurt'),
    t('details'),
    t('confirmPay'),
  ]

  function handleStepClick(step: number) {
    // Only allow navigating back to completed steps
    if (step < currentStep) {
      router.push(STEP_PATHS[step - 1])
    }
  }

  return (
    <div className="w-full bg-white shadow-sm py-4 sm:py-6 lg:py-8 px-4 sm:px-10 lg:px-20 flex justify-center">
      <div className="flex items-center">
        {steps.map((label, i) => {
          const step = i + 1
          const isCompleted = step < currentStep
          const isCurrent = step === currentStep
          const isClickable = isCompleted
          return (
            <div key={label} className="flex items-center">
              <button
                type="button"
                onClick={() => handleStepClick(step)}
                disabled={!isClickable}
                aria-label={`Step ${step}: ${label}${isCompleted ? ' (completed, click to go back)' : isCurrent ? ' (current)' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex flex-col items-center gap-2.5 bg-transparent border-none p-0 ${
                  isClickable ? 'cursor-pointer' : isCurrent ? 'cursor-default' : 'cursor-default'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                    isCompleted ? 'bg-green border-green text-white'
                      : isCurrent ? 'bg-amber border-amber text-white'
                      : 'bg-white border-beige text-beige'
                  } ${isClickable ? 'hover:ring-2 hover:ring-green/30' : ''}`}>
                  {isCompleted ? <Check size={18} /> : step}
                </div>
                <span className={`text-xs font-medium ${
                    isCurrent ? 'text-brown font-semibold' : isCompleted ? 'text-green' : 'text-[#8E8E93]'
                  } ${isClickable ? 'hover:underline' : ''}`}>{label}</span>
              </button>
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
