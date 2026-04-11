'use client'

import { useEffect } from 'react'

export default function PwaHead() {
  useEffect(() => {
    // Add manifest link
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link')
      link.rel = 'manifest'
      link.href = '/manifest.json'
      document.head.appendChild(link)
    }

    // Add theme-color
    if (!document.querySelector('meta[name="theme-color"]')) {
      const meta = document.createElement('meta')
      meta.name = 'theme-color'
      meta.content = '#6B7F5E'
      document.head.appendChild(meta)
    }

    // Add apple-mobile-web-app-capable
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const meta = document.createElement('meta')
      meta.name = 'apple-mobile-web-app-capable'
      meta.content = 'yes'
      document.head.appendChild(meta)
    }
  }, [])

  return null
}
