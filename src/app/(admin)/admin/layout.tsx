import AdminNavbar from '@/components/admin/AdminNavbar'
import AdminBottomTabs from '@/components/admin/AdminBottomTabs'
import AdminAuthGuard from '@/components/admin/AdminAuthGuard'
import AdminSwrProvider from '@/components/admin/AdminSwrProvider'
import OfflineBanner from '@/components/admin/OfflineBanner'
import ServiceWorkerRegistrar from '@/components/admin/ServiceWorkerRegistrar'
import PushNotificationManager from '@/components/admin/PushNotificationManager'
import PwaHead from '@/components/admin/PwaHead'
import PwaInstallPrompt from '@/components/admin/PwaInstallPrompt'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthGuard>
      <AdminSwrProvider>
        <PwaHead />
        <ServiceWorkerRegistrar />
        <PushNotificationManager />
        <div className="fixed inset-0 flex flex-col bg-[#F8F7F4]">
          <AdminNavbar />
          <OfflineBanner />
          <PwaInstallPrompt />
          <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {children}
          </main>
          <AdminBottomTabs />
        </div>
      </AdminSwrProvider>
    </AdminAuthGuard>
  )
}
