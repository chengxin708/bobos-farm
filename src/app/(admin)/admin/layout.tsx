import Sidebar from '@/components/admin/Sidebar'
import AdminAuthGuard from '@/components/admin/AdminAuthGuard'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthGuard>
      <div className="flex min-h-screen bg-cream-bg">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-auto">
          {children}
        </main>
      </div>
    </AdminAuthGuard>
  )
}
