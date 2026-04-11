'use client'

import { usePathname } from 'next/navigation'
import Navbar from '@/components/customer/Navbar'
import Footer from '@/components/customer/Footer'
import BottomTabs from '@/components/customer/BottomTabs'

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isBooking = pathname.startsWith('/booking')

  if (isBooking) {
    return (
      <div className="h-[100dvh] flex flex-col bg-[#F8F7F4]">
        {children}
      </div>
    )
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-[#F8F7F4]">
      <Navbar />
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain" id="main-scroll">
        {children}
        <Footer />
      </main>
      <BottomTabs />
    </div>
  )
}
