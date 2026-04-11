'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PwaInstallPrompt() {
  const t = useTranslations('admin.common')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check if already dismissed in this session
    if (sessionStorage.getItem('pwa-prompt-dismissed')) {
      setDismissed(true)
      return
    }

    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setDismissed(true)
      return
    }

    function handleBeforeInstall(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  if (dismissed || !deferredPrompt) return null

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDismissed(true)
    }
    setDeferredPrompt(null)
  }

  function handleDismiss() {
    setDismissed(true)
    sessionStorage.setItem('pwa-prompt-dismissed', '1')
  }

  return (
    <div className="mx-4 mt-3 mb-1 flex items-center gap-3 bg-white border border-[#E8ECE4] rounded-xl p-3 shadow-sm">
      <div className="w-10 h-10 rounded-full bg-[#E8ECE4] flex items-center justify-center shrink-0">
        <Download size={18} className="text-[#6B7F5E]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[#1A1208]">{t('pwaInstallTitle')}</div>
        <div className="text-xs text-[#8C8478]">{t('pwaInstallDesc')}</div>
      </div>
      <button
        onClick={handleInstall}
        className="px-3 py-1.5 bg-[#6B7F5E] text-white text-xs font-medium rounded-full shrink-0 border-0 cursor-pointer"
      >
        {t('pwaInstall')}
      </button>
      <button
        onClick={handleDismiss}
        className="p-1 text-[#8C8478] bg-transparent border-0 cursor-pointer shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  )
}
