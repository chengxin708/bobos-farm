'use client'

import { SWRConfig } from 'swr'
import { adminSwrConfig } from '@/lib/swr-config'

export default function AdminSwrProvider({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={adminSwrConfig}>{children}</SWRConfig>
}
