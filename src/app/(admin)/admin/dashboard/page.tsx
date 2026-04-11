'use client'

import { useIsMobile } from '@/hooks/useIsMobile'
import DashboardMobile from '@/components/admin/dashboard/DashboardMobile'
import DashboardDesktop from '@/components/admin/dashboard/DashboardDesktop'

export default function DashboardPage() {
  const isMobile = useIsMobile()
  return isMobile ? <DashboardMobile /> : <DashboardDesktop />
}
