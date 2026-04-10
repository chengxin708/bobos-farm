'use client'

import { usePathname } from 'next/navigation'
import Navbar from '@/components/customer/Navbar'
import Footer from '@/components/customer/Footer'

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isBooking = pathname.startsWith('/booking')

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar />
      <main className="flex-1 flex flex-col min-h-0">{children}</main>
      {!isBooking && <Footer />}
    </div>
  )
}
