import Sidebar from '@/components/admin/Sidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-cream-bg">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-auto">
        {children}
      </main>
    </div>
  )
}
