'use client'

import { usePathname } from 'next/navigation'
import Navbar from '@/components/customer/Navbar'
import Footer from '@/components/customer/Footer'
import BottomTabs from '@/components/customer/BottomTabs'

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isBooking = pathname.startsWith('/booking')

  if (isBooking) {
    // Booking flow: full screen, no navbar/footer/tabs, frame locked
    return (
      <div className="fixed inset-0 flex flex-col bg-[#F8F7F4] overscroll-none touch-none"
           style={{ height: '100dvh' }}>
        <main className="flex-1 flex flex-col min-h-0 touch-auto">{children}</main>
      </div>
    )
  }

  // App-like layout: navbar + tabs fixed, only content scrolls
  return (
    <div className="fixed inset-0 flex flex-col bg-[#F8F7F4] overscroll-none"
         style={{ height: '100dvh' }}>
      <Navbar />
      <main className="flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-contain">
        {children}
        <Footer />
      </main>
      <BottomTabs />
    </div>
  )
}
