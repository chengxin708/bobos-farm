'use client'

import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import { Loader2 } from 'lucide-react'
import Navbar from '@/components/customer/Navbar'
import Footer from '@/components/customer/Footer'
import BottomTabs from '@/components/customer/BottomTabs'
import TestingBanner from '@/components/customer/TestingBanner'
import BookingClosedNotice from '@/components/customer/BookingClosedNotice'
import { paymentsEnabled } from '@/lib/feature-flags'

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Focused full-screen flows: no global navbar/footer so the page can
  // own its own top bar (with its own language toggle) and bottom CTA.
  const isFocusedFlow = pathname.startsWith('/booking') || pathname === '/inquiries/new'

  // "Under development" master switch: when on, the booking + inquiry flows
  // are replaced by a call-us notice. Only fetched inside those flows, and
  // fails open (booking stays available) if the settings request errors.
  const { data: publicSettings, error: settingsError } = useSWR<Record<string, string>>(
    isFocusedFlow ? '/api/settings/public' : null,
    fetcher,
    { revalidateOnFocus: false },
  )
  const settingsReady = publicSettings !== undefined || settingsError !== undefined
  const bookingMaintenance = publicSettings?.booking_maintenance === 'true'

  if (isFocusedFlow) {
    return (
      <div className="fixed inset-0 flex flex-col bg-[#F8F7F4]">
        {!paymentsEnabled && <TestingBanner />}
        {!settingsReady ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-[#6B7F5E]" />
          </div>
        ) : bookingMaintenance ? (
          <BookingClosedNotice />
        ) : (
          children
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#F8F7F4]">
      {!paymentsEnabled && <TestingBanner />}
      <Navbar />
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain" id="main-scroll">
        {children}
        <Footer />
      </main>
      <BottomTabs />
    </div>
  )
}
