'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { WifiOff } from 'lucide-react'

export default function OfflineBanner() {
  const t = useTranslations('admin.common')
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    setIsOffline(!navigator.onLine)

    function handleOnline() { setIsOffline(false) }
    function handleOffline() { setIsOffline(true) }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="bg-[#FFF8E1] border-b border-[#E67E22]/20 px-4 py-2 flex items-center justify-center gap-2 shrink-0">
      <WifiOff size={14} className="text-[#E67E22]" />
      <span className="text-xs font-medium text-[#E67E22]">
        {t('offline')}
      </span>
    </div>
  )
}
