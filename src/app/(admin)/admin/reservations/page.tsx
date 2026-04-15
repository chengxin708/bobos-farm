'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useIsMobile } from '@/hooks/useIsMobile'

const ReservationsMobile = dynamic(() => import('@/components/admin/reservations/ReservationsMobile'), { ssr: false })
const ReservationsDesktop = dynamic(() => import('@/components/admin/reservations/ReservationsDesktop'), { ssr: false })

function ReservationsContent() {
  const isMobile = useIsMobile()
  return isMobile ? <ReservationsMobile /> : <ReservationsDesktop />
}

export default function ReservationsPage() {
  const tc = useTranslations('admin.common')
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center bg-[#F8F7F4]"><p className="text-[#8C8478]">{tc('loading')}</p></div>}>
      <ReservationsContent />
    </Suspense>
  )
}
