import AdminNavbar from '@/components/admin/AdminNavbar'
import AdminBottomTabs from '@/components/admin/AdminBottomTabs'
import AdminAuthGuard from '@/components/admin/AdminAuthGuard'
import OfflineBanner from '@/components/admin/OfflineBanner'
import ServiceWorkerRegistrar from '@/components/admin/ServiceWorkerRegistrar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthGuard>
      <ServiceWorkerRegistrar />
      <div className="fixed inset-0 flex flex-col bg-[#F8F7F4]">
        <AdminNavbar />
        <OfflineBanner />
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {children}
        </main>
        <AdminBottomTabs />
      </div>
    </AdminAuthGuard>
  )
}
