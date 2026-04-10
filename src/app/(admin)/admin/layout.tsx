import Sidebar from '@/components/admin/Sidebar'
import AdminAuthGuard from '@/components/admin/AdminAuthGuard'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthGuard>
      <div className="flex min-h-screen bg-[#F5F2ED]">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-auto min-h-screen">
          {children}
        </main>
      </div>
    </AdminAuthGuard>
  )
}
