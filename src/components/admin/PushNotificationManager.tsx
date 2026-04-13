'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Headless component that sets up Web Push subscription for the current user.
 * Renders nothing. Should be placed inside an authenticated layout.
 */
export default function PushNotificationManager() {
  const { data: session } = useSession()

  useEffect(() => {
    if (!session?.user || !VAPID_PUBLIC_KEY) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    async function setupPush() {
      try {
        const registration = await navigator.serviceWorker.ready

        // Check if already subscribed
        let subscription = await registration.pushManager.getSubscription()

        if (!subscription) {
          // Request notification permission
          const permission = await Notification.requestPermission()
          if (permission !== 'granted') return

          // Create a new push subscription
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          })
        }

        // Extract keys and send subscription to server
        const p256dhKey = subscription.getKey('p256dh')
        const authKey = subscription.getKey('auth')
        if (!p256dhKey || !authKey) return

        const p256dh = btoa(String.fromCharCode(...new Uint8Array(p256dhKey)))
        const auth = btoa(String.fromCharCode(...new Uint8Array(authKey)))

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: { p256dh, auth },
          }),
        })
      } catch (err) {
        console.error('[Push] Setup failed:', err)
      }
    }

    setupPush()
  }, [session])

  return null
}
