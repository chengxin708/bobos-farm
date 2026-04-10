"use client"

import { useEffect } from "react"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Admin section error:", error)
  }, [error])

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 gap-6 bg-cream-bg">
      <div className="w-16 h-16 rounded-full bg-[#DC3545]/10 flex items-center justify-center">
        <span className="text-[#DC3545] text-2xl font-bold">!</span>
      </div>
      <h2 className="text-xl font-bold text-brown text-center">
        Something went wrong
      </h2>
      <p className="text-sm text-gray-text text-center max-w-md">
        An unexpected error occurred. Please try again or return to the
        dashboard.
      </p>
      <div className="flex gap-3">
        <a
          href="/admin/dashboard"
          className="px-5 py-2 rounded-md border border-beige text-brown text-sm font-medium no-underline"
        >
          Dashboard
        </a>
        <button
          onClick={reset}
          className="px-5 py-2 rounded-md bg-amber text-white text-sm font-semibold cursor-pointer border-none"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
