'use client'

import { usePathname } from 'next/navigation'
import Navbar from '@/components/customer/Navbar'
import Footer from '@/components/customer/Footer'
import BottomTabs from '@/components/customer/BottomTabs'

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isBooking = pathname.startsWith('/booking')

  if (isBooking) {
    // Booking: full screen, each page manages its own top/bottom bars
    return (
      <div className="h-full flex flex-col bg-[#F8F7F4]">
        {children}
      </div>
    )
  }

  // Normal pages: Navbar top, content scrolls, BottomTabs bottom
  return (
    <div className="h-full flex flex-col bg-[#F8F7F4]">
      <Navbar />
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain" id="main-scroll">
        {children}
        <Footer />
      </main>
      <BottomTabs />
    </div>
  )
}
