'use client'

import dynamic from 'next/dynamic'
import { useIsMobile } from '@/hooks/useIsMobile'

const CalendarMobile = dynamic(() => import('@/components/admin/calendar/CalendarMobile'), { ssr: false })
const CalendarDesktop = dynamic(() => import('@/components/admin/calendar/CalendarDesktop'), { ssr: false })

export default function CalendarPage() {
  const isMobile = useIsMobile()
  return isMobile ? <CalendarMobile /> : <CalendarDesktop />
}
