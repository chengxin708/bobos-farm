'use client'

import { useIsMobile } from '@/hooks/useIsMobile'
import CalendarMobile from '@/components/admin/calendar/CalendarMobile'
import CalendarDesktop from '@/components/admin/calendar/CalendarDesktop'

export default function CalendarPage() {
  const isMobile = useIsMobile()
  return isMobile ? <CalendarMobile /> : <CalendarDesktop />
}
