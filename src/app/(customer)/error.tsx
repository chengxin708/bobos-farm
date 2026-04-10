"use client"

import { useEffect } from "react"

export default function CustomerError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Customer section error:", error)
  }, [error])

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 gap-6 bg-cream">
      <div className="w-16 h-16 rounded-full bg-red/10 flex items-center justify-center">
        <span className="text-red text-2xl font-bold">!</span>
      </div>
      <h2 className="font-playfair text-2xl font-bold text-brown text-center">
        Something went wrong
      </h2>
      <p className="text-sm text-brown/60 text-center max-w-md">
        We encountered an unexpected error. Please try again or return to the
        home page.
      </p>
      <div className="flex gap-3">
        <a
          href="/"
          className="px-6 py-2.5 rounded-xl border border-beige text-brown text-sm font-medium no-underline"
        >
          Go Home
        </a>
        <button
          onClick={reset}
          className="px-6 py-2.5 rounded-xl bg-amber text-white text-sm font-semibold cursor-pointer border-none"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
