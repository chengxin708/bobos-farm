"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, type ReactNode } from "react"

/**
 * Client-side auth guard for admin routes.
 * Redirects non-authenticated users to /login and
 * non-ADMIN users to the home page.
 */
export default function AdminAuthGuard({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const tc = useTranslations('admin.common')

  useEffect(() => {
    if (status === "loading") return

    if (status === "unauthenticated") {
      router.replace("/admin/login?callbackUrl=/admin/dashboard")
      return
    }

    const role = (session?.user as { role?: string } | undefined)?.role
    if (role !== "ADMIN") {
      router.replace("/")
    }
  }, [status, session, router])

  // Show loading state while checking auth
  if (status === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center bg-cream-bg min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-[3px] border-beige border-t-amber animate-spin" />
          <span className="text-sm text-gray-text">{tc('loading')}</span>
        </div>
      </div>
    )
  }

  // Don't render children if not admin
  const role = (session?.user as { role?: string } | undefined)?.role
  if (status === "unauthenticated" || role !== "ADMIN") {
    return null
  }

  return <>{children}</>
}
