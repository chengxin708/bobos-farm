"use client"

import { BookingProvider } from '@/contexts/BookingContext'

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <BookingProvider>
      <div className="bg-[#F8F7F4] flex flex-col" style={{ height: '100dvh' }}>
        {children}
      </div>
    </BookingProvider>
  )
}
