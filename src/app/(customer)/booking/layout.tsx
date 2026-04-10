"use client"

import { usePathname } from 'next/navigation'
import BookingStepper from '@/components/customer/BookingStepper'
import { BookingProvider } from '@/contexts/BookingContext'

const stepMap: Record<string, number> = {
  '/booking/date': 1,
  '/booking/yurt': 2,
  '/booking/details': 3,
  '/booking/confirm': 4,
}

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const currentStep = stepMap[pathname] || 1
  return (
    <BookingProvider>
      <div className="flex flex-col flex-1 min-h-0 bg-cream">
        <BookingStepper currentStep={currentStep} />
        {children}
      </div>
    </BookingProvider>
  )
}
