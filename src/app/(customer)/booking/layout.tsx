"use client"

import { BookingProvider } from '@/contexts/BookingContext'

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <BookingProvider>
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </BookingProvider>
  )
}
