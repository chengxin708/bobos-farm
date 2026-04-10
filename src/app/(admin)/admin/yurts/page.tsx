"use client"

import { useState, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import TopBar from '@/components/admin/TopBar'
import { Plus, Edit, Eye, Users, AlertTriangle, X, ChevronRight } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────

interface Yurt {
  id: string
  name: string
  description: string | null
  capacity: number
  status: 'ACTIVE' | 'MAINTENANCE'
  imageUrl: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

interface YurtFormData {
  name: string
  description: string
  capacity: number
  status: 'ACTIVE' | 'MAINTENANCE'
  imageUrl: string
}

// ── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

const defaultForm: YurtFormData = {
  name: '',
  description: '',
  capacity: 6,
  status: 'ACTIVE',
  imageUrl: '',
}

// ── Component ──────────────────────────────────────────────────────

export default function YurtManagement() {
  const t = useTranslations('admin.yurts')
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingYurt, setEditingYurt] = useState<Yurt | null>(null)
  const [form, setForm] = useState<YurtFormData>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 3000)
  }, [])

  // Redirect non-admin
  useEffect(() => {
    if (sessionStatus === 'authenticated' && (session?.user as { role?: string })?.role !== 'ADMIN') {
      router.push('/')
    }
  }, [sessionStatus, session, router])

  const { data: yurts, isLoading, mutate } = useSWR<Yurt[]>('/api/yurts', fetcher)

  // Open modal for new yurt
  const openAddModal = useCallback(() => {
    setEditingYurt(null)
    setForm(defaultForm)
    setModalOpen(true)
  }, [])

  // Open modal for editing
  const openEditModal = useCallback((yurt: Yurt) => {
    setEditingYurt(yurt)
    setForm({
      name: yurt.name,
      description: yurt.description || '',
      capacity: yurt.capacity,
      status: yurt.status,
      imageUrl: yurt.imageUrl || '',
    })
    setModalOpen(true)
  }, [])

  // Save (create or update)
  const handleSave = useCallback(async () => {
    if (!form.name.trim()) { alert('Name is required'); return }
    if (form.capacity < 1) { alert('Capacity must be at least 1'); return }

    // Confirm if switching to maintenance
    if (editingYurt && editingYurt.status === 'ACTIVE' && form.status === 'MAINTENANCE') {
      if (!confirm(`Set ${form.name} to Maintenance? It will be unavailable for new bookings.`)) return
    }

    setSaving(true)
    try {
      const url = editingYurt ? `/api/yurts/${editingYurt.id}` : '/api/yurts'
      const method = editingYurt ? 'PATCH' : 'POST'

      const body: Record<string, unknown> = {
        name: form.name,
        description: form.description || undefined,
        capacity: form.capacity,
        status: form.status,
      }
      if (form.imageUrl) body.imageUrl = form.imageUrl

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Failed to save yurt')
        return
      }

      mutate()
      setModalOpen(false)
      showSuccess(editingYurt ? `${form.name} updated successfully.` : `${form.name} created successfully.`)
    } catch {
      alert('Failed to save yurt')
    } finally {
      setSaving(false)
    }
  }, [form, editingYurt, mutate, showSuccess])

  // ── Loading state ────────────────────────────────────────────

  if (sessionStatus === 'loading') {
    return (
      <>
        <TopBar title={t('title')} />
        <div className="flex-1 p-6 flex items-center justify-center bg-cream-bg">
          <p className="text-gray-text">Loading...</p>
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar title={t('title')} />
      <div className="flex-1 p-6 flex flex-col gap-5 bg-cream-bg overflow-auto">
        {/* Success Message */}
        {successMsg && (
          <div className="bg-[#EAF2E3] border border-[#5B8C3E]/30 text-[#2D5016] rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-between">
            {successMsg}
            <button onClick={() => setSuccessMsg(null)} className="text-[#2D5016]/60 hover:text-[#2D5016]">
              <span className="text-lg leading-none">&times;</span>
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-brown font-playfair">{t('title')}</h2>
            <p className="text-sm text-gray-text">{t('subtitle')}</p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 bg-amber text-white text-sm font-semibold px-4 py-2 rounded-md cursor-pointer border-none"
          >
            <Plus size={14} /> {t('addYurt')}
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="bg-white rounded-xl border border-beige p-12 text-center">
            <p className="text-gray-text text-sm">Loading yurts...</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!yurts || yurts.length === 0) && (
          <div className="bg-white rounded-xl border border-beige p-12 text-center">
            <p className="text-gray-text text-sm">No yurts found. Add your first yurt to get started.</p>
          </div>
        )}

        {/* Yurt Cards */}
        {yurts?.map((yurt) => (
          <div key={yurt.id} className="bg-white rounded-xl border border-beige p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-brown font-playfair">{yurt.name}</h3>
                {yurt.description && (
                  <p className="text-sm text-gray-text mt-1 max-w-[600px]">{yurt.description}</p>
                )}
              </div>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${
                yurt.status === 'ACTIVE' ? 'bg-[#EAF2E3] text-[#5B8C3E]' : 'bg-[#FEF3CD] text-amber'
              }`}>
                {yurt.status === 'ACTIVE' ? t('status.active') : t('status.maintenance')}
              </span>
            </div>

            {/* Maintenance notice */}
            {yurt.status === 'MAINTENANCE' && (
              <div className="flex items-center gap-2 bg-[#FFF8E1] border border-[#FFE082] rounded-lg px-4 py-2.5">
                <AlertTriangle size={14} className="text-[#F4A623] shrink-0" />
                <span className="text-xs text-brown">This yurt is currently under maintenance and unavailable for booking.</span>
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center gap-6 text-sm text-brown">
              <span className="flex items-center gap-1.5">
                <Users size={14} className="text-gray-text" /> {t('capacity')} {yurt.capacity} {t('guests')}
              </span>
              {yurt.imageUrl && (
                <span className="text-amber text-xs">Has image</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => openEditModal(yurt)}
                className="flex items-center gap-1.5 text-sm text-amber font-semibold cursor-pointer bg-transparent border-none"
              >
                <Edit size={14} /> {t('actions.edit')}
              </button>
              <button className="flex items-center gap-1.5 text-sm text-brown cursor-pointer bg-transparent border-none">
                <Eye size={14} /> {t('actions.viewDetails')}
              </button>
              <ChevronRight size={14} className="text-gray-text" />
            </div>
          </div>
        ))}
      </div>

      {/* Edit/Add Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-beige">
              <h3 className="text-lg font-bold text-brown font-playfair">
                {editingYurt ? `Edit ${editingYurt.name}` : 'Add New Yurt'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 hover:bg-beige/30 rounded cursor-pointer bg-transparent border-none"
              >
                <X size={18} className="text-gray-text" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-brown">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Golden Meadow"
                  className="border border-beige rounded-md px-3 py-2 text-sm text-brown outline-none focus:ring-2 focus:ring-amber/30"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-brown">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the yurt, its features, and setting..."
                  className="border border-beige rounded-md px-3 py-2 text-sm text-brown h-24 resize-none outline-none focus:ring-2 focus:ring-amber/30"
                />
              </div>

              {/* Capacity */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-brown">Capacity (guests)</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.capacity}
                  onChange={(e) => setForm(f => ({ ...f, capacity: parseInt(e.target.value) || 1 }))}
                  className="border border-beige rounded-md px-3 py-2 text-sm text-brown w-32 outline-none focus:ring-2 focus:ring-amber/30"
                />
              </div>

              {/* Status */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-brown">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm(f => ({ ...f, status: e.target.value as 'ACTIVE' | 'MAINTENANCE' }))}
                  className="border border-beige rounded-md px-3 py-2 text-sm text-brown outline-none focus:ring-2 focus:ring-amber/30 bg-white"
                >
                  <option value="ACTIVE">{t('status.active')}</option>
                  <option value="MAINTENANCE">{t('status.maintenance')}</option>
                </select>
              </div>

              {/* Image URL */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-brown">Image URL</label>
                <input
                  type="text"
                  value={form.imageUrl}
                  onChange={(e) => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                  placeholder="https://..."
                  className="border border-beige rounded-md px-3 py-2 text-sm text-brown outline-none focus:ring-2 focus:ring-amber/30"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-beige">
              <button
                onClick={() => setModalOpen(false)}
                className="px-5 py-2 text-sm font-semibold text-gray-text border border-beige rounded-md bg-white cursor-pointer hover:bg-beige/30"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 text-sm font-semibold text-white bg-amber rounded-md cursor-pointer disabled:opacity-50 hover:bg-amber/90 border-none"
              >
                {saving ? 'Saving...' : editingYurt ? 'Save Changes' : 'Add Yurt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
