"use client"

import { BookingProvider } from '@/contexts/BookingContext'

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <BookingProvider>
      <div className="min-h-[100svh] bg-[#F8F7F4] flex flex-col overflow-y-auto">
        {children}
      </div>
    </BookingProvider>
  )
}
