'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useIsMobile } from '@/hooks/useIsMobile'

const ReservationsMobile = dynamic(() => import('@/components/admin/reservations/ReservationsMobile'), { ssr: false })
const ReservationsDesktop = dynamic(() => import('@/components/admin/reservations/ReservationsDesktop'), { ssr: false })

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
