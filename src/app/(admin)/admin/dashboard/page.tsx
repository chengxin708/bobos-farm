'use client'

import dynamic from 'next/dynamic'
import { useIsMobile } from '@/hooks/useIsMobile'

const DashboardMobile = dynamic(() => import('@/components/admin/dashboard/DashboardMobile'), { ssr: false })
const DashboardDesktop = dynamic(() => import('@/components/admin/dashboard/DashboardDesktop'), { ssr: false })

export default function DashboardPage() {
  const isMobile = useIsMobile()
  return isMobile ? <DashboardMobile /> : <DashboardDesktop />
}
