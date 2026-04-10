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
    <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 gap-6 bg-[#F8F7F4]">
      <div className="w-16 h-16 rounded-full bg-[#C4453A]/10 flex items-center justify-center">
        <span className="text-[#C4453A] text-2xl font-bold">!</span>
      </div>
      <h2 className="font-serif text-2xl font-bold text-[#1A1208] text-center">
        Something went wrong
      </h2>
      <p className="text-sm text-[#8C8478] text-center max-w-md">
        We encountered an unexpected error. Please try again or return to the
        home page.
      </p>
      <div className="flex gap-3">
        <a
          href="/"
          className="px-6 py-3 rounded-full border border-[#E8ECE4] text-[#1A1208] text-sm font-medium no-underline hover:bg-[#E8ECE4] transition-colors"
        >
          Go Home
        </a>
        <button
          onClick={reset}
          className="px-6 py-3 rounded-full bg-[#6B7F5E] text-white text-sm font-semibold cursor-pointer border-none hover:brightness-90 active:scale-[0.97] transition-all"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
