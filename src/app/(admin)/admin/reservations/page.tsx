'use client'

import { Suspense } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import ReservationsMobile from '@/components/admin/reservations/ReservationsMobile'
import ReservationsDesktop from '@/components/admin/reservations/ReservationsDesktop'

function ReservationsContent() {
  const isMobile = useIsMobile()
  return isMobile ? <ReservationsMobile /> : <ReservationsDesktop />
}

export default function ReservationsPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center bg-[#F8F7F4]"><p className="text-[#8C8478]">Loading...</p></div>}>
      <ReservationsContent />
    </Suspense>
  )
}
