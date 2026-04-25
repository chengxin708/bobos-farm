'use client'

import { usePathname } from 'next/navigation'
import Navbar from '@/components/customer/Navbar'
import Footer from '@/components/customer/Footer'
import BottomTabs from '@/components/customer/BottomTabs'
import TestingBanner from '@/components/customer/TestingBanner'

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Focused full-screen flows: no global navbar/footer so the page can
  // own its own top bar (with its own language toggle) and bottom CTA.
  const isFocusedFlow = pathname.startsWith('/booking') || pathname === '/inquiries/new'

  if (isFocusedFlow) {
    return (
      <div className="fixed inset-0 flex flex-col bg-[#F8F7F4]">
        <TestingBanner />
        {children}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#F8F7F4]">
      <TestingBanner />
      <Navbar />
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain" id="main-scroll">
        {children}
        <Footer />
      </main>
      <BottomTabs />
    </div>
  )
}
