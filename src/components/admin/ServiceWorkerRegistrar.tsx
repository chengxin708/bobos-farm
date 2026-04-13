'use client'

import { useEffect, useState, useCallback, createContext, useContext } from 'react'
import { RefreshCw, X } from 'lucide-react'

// Context to expose SW update state to Settings page
interface SwUpdateContextValue {
  hasUpdate: boolean
  forceRefresh: () => void
}

const SwUpdateContext = createContext<SwUpdateContextValue>({
  hasUpdate: false,
  forceRefresh: () => {},
})

export function useSwUpdate() {
  return useContext(SwUpdateContext)
}

export default function ServiceWorkerRegistrar({ children }: { children?: React.ReactNode }) {
  const [hasUpdate, setHasUpdate] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    async function register() {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')

        // Check for waiting worker on initial load
        if (reg.waiting) {
          setWaitingWorker(reg.waiting)
          setHasUpdate(true)
        }

        // Listen for new service worker installing
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              setWaitingWorker(newWorker)
              setHasUpdate(true)
            }
          })
        })

        // Periodically check for updates (every 5 minutes)
        setInterval(() => {
          reg.update().catch(() => {})
        }, 5 * 60 * 1000)
      } catch {
        // SW registration failed, not critical
      }
    }

    // Listen for controller change (new SW activated) → reload
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    })

    register()
  }, [])

  const forceRefresh = useCallback(() => {
    if (waitingWorker) {
      // Tell waiting worker to skip waiting and become active
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
    } else {
      // No waiting worker, just hard reload
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(reg => {
          if (reg) {
            reg.unregister().then(() => {
              caches.keys().then(keys => {
                Promise.all(keys.map(k => caches.delete(k))).then(() => {
                  window.location.reload()
                })
              })
            })
          } else {
            window.location.reload()
          }
        })
      } else {
        window.location.reload()
      }
    }
  }, [waitingWorker])

  return (
    <SwUpdateContext.Provider value={{ hasUpdate, forceRefresh }}>
      {/* Update banner */}
      {hasUpdate && !dismissed && (
        <div className="bg-[#6B7F5E] text-white px-4 py-2 flex items-center justify-center gap-3 shrink-0 text-sm">
          <RefreshCw size={14} className="animate-spin-slow" />
          <span>New version available</span>
          <button
            onClick={forceRefresh}
            className="px-3 py-1 bg-white text-[#6B7F5E] text-xs font-semibold rounded-full border-0 cursor-pointer hover:bg-white/90"
          >
            Update now
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-0.5 bg-transparent border-0 cursor-pointer text-white/70 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {children}
    </SwUpdateContext.Provider>
  )
}
