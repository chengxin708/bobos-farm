'use client'

import { usePathname } from 'next/navigation'
import Navbar from '@/components/customer/Navbar'
import Footer from '@/components/customer/Footer'
import BottomTabs from '@/components/customer/BottomTabs'

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isBooking = pathname.startsWith('/booking')

  return (
    <div className={`flex flex-col ${isBooking ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      <Navbar />
      <main className="flex-1 flex flex-col pb-20 md:pb-0">{children}</main>
      {!isBooking && <Footer />}
      <BottomTabs />
    </div>
  )
}
