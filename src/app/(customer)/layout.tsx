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
      <div className="fixed inset-0 flex flex-col bg-[#F8F7F4]"
           style={{ height: '100dvh' }}>
        <main className="flex-1 flex flex-col min-h-0">{children}</main>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#F8F7F4]"
         style={{ height: '100dvh' }}>
      <div className="shrink-0"><Navbar /></div>
      <main className="flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-contain"
            id="main-scroll">
        {children}
        <Footer />
      </main>
      <div className="shrink-0 md:hidden"><BottomTabs /></div>
    </div>
  )
}
