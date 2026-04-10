"use client"

import { useState, useCallback, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import TopBar from '@/components/admin/TopBar'
import {
  Plus, Pencil, Trash2, X, Upload, GripVertical, Image as ImageIcon,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────

interface MenuCategory {
  id: string
  nameEn: string
  nameZh: string | null
  sortOrder: number
  _count?: { items: number }
}

interface MenuItem {
  id: string
  categoryId: string
  nameEn: string
  nameZh: string | null
  price: number
  descriptionEn: string | null
  descriptionZh: string | null
  imageUrl: string | null
  tags: string[]
  isActive: boolean
  advanceDaysRequired: number
  sortOrder: number
  category?: MenuCategory
}

interface ItemFormData {
  nameEn: string
  nameZh: string
  categoryId: string
  price: string
  descriptionEn: string
  descriptionZh: string
  tags: string[]
  advanceDaysRequired: string
  sortOrder: string
  isActive: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

const tagColorMap: Record<string, string> = {
  'Farm Fresh': 'bg-light-green-bg text-green',
  'Signature': 'bg-[#FEF3CD] text-amber',
  'Seasonal': 'bg-light-blue-bg text-blue',
  'Popular': 'bg-[#F3E8FF] text-[#7C3AED]',
  'Limited Batch': 'bg-[#FFF3E0] text-orange',
  'Fan Fave': 'bg-[#FCE7F3] text-[#DB2777]',
  'Winter Special': 'bg-gray-100 text-gray-text',
  'Pre-order': 'bg-terracotta-light text-terracotta',
}

function getTagClasses(tag: string): string {
  return tagColorMap[tag] || 'bg-gray-100 text-gray-text'
}

function getSupabasePublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base || !path) return ''
  // If path is already a full URL, return as-is
  if (path.startsWith('http')) return path
  return `${base}/storage/v1/object/public/menu-images/${path}`
}

const emptyForm: ItemFormData = {
  nameEn: '',
  nameZh: '',
  categoryId: '',
  price: '',
  descriptionEn: '',
  descriptionZh: '',
  tags: [],
  advanceDaysRequired: '0',
  sortOrder: '0',
  isActive: true,
}

// ─── Component ──────────────────────────────────────────────────────

export default function MenuManagement() {
  const t = useTranslations('admin.menu')
  const { data: session, status } = useSession()
  const router = useRouter()

  // Redirect non-admin
  useEffect(() => {
    if (status === 'authenticated' && (session?.user as { role?: string })?.role !== 'ADMIN') {
      router.push('/admin/dashboard')
    }
  }, [status, session, router])

  // ── Data fetching ──
  const {
    data: categories = [],
    mutate: mutateCategories,
  } = useSWR<MenuCategory[]>('/api/menu/categories', fetcher)

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)

  // Auto-select first category when loaded
  useEffect(() => {
    if (categories.length > 0 && !activeCategoryId) {
      setActiveCategoryId(categories[0].id)
    }
  }, [categories, activeCategoryId])

  const {
    data: items = [],
    mutate: mutateItems,
  } = useSWR<MenuItem[]>(
    activeCategoryId ? `/api/menu/items?categoryId=${activeCategoryId}` : null,
    fetcher
  )

  // ── Drawer state ──
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [form, setForm] = useState<ItemFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [tagInput, setTagInput] = useState('')

  // ── Image upload state ──
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Category modal state ──
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null)
  const [categoryForm, setCategoryForm] = useState({ nameEn: '', nameZh: '', sortOrder: '0' })
  const [savingCategory, setSavingCategory] = useState(false)

  // ── Drawer helpers ──
  const openAddDrawer = useCallback(() => {
    setEditingItem(null)
    setForm({ ...emptyForm, categoryId: activeCategoryId || '' })
    setImageFile(null)
    setImagePreview(null)
    setDrawerOpen(true)
  }, [activeCategoryId])

  const openEditDrawer = useCallback((item: MenuItem) => {
    setEditingItem(item)
    setForm({
      nameEn: item.nameEn,
      nameZh: item.nameZh || '',
      categoryId: item.categoryId,
      price: item.price.toString(),
      descriptionEn: item.descriptionEn || '',
      descriptionZh: item.descriptionZh || '',
      tags: [...item.tags],
      advanceDaysRequired: item.advanceDaysRequired.toString(),
      sortOrder: item.sortOrder.toString(),
      isActive: item.isActive,
    })
    setImageFile(null)
    setImagePreview(item.imageUrl ? getSupabasePublicUrl(item.imageUrl) : null)
    setDrawerOpen(true)
  }, [])

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    setEditingItem(null)
    setImageFile(null)
    setImagePreview(null)
    setTagInput('')
  }, [])

  // ── Form field helpers ──
  const updateForm = (field: keyof ItemFormData, value: string | boolean | string[]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const addTag = () => {
    const tag = tagInput.trim()
    if (tag && !form.tags.includes(tag)) {
      updateForm('tags', [...form.tags, tag])
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    updateForm('tags', form.tags.filter(t => t !== tag))
  }

  // ── Image handling ──
  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Maximum size: 5MB')
      return
    }
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleImageSelect(file)
  }

  const uploadImage = async (itemId: string): Promise<void> => {
    if (!imageFile) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', imageFile)
      const res = await fetch(`/api/menu/items/${itemId}/image`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Upload failed')
      }
    } finally {
      setUploading(false)
    }
  }

  // ── Save item ──
  const handleSave = async () => {
    if (!form.nameEn.trim() || !form.categoryId || !form.price) return
    setSaving(true)
    try {
      const payload = {
        nameEn: form.nameEn.trim(),
        nameZh: form.nameZh.trim() || undefined,
        categoryId: form.categoryId,
        price: parseFloat(form.price),
        descriptionEn: form.descriptionEn.trim() || undefined,
        descriptionZh: form.descriptionZh.trim() || undefined,
        tags: form.tags,
        advanceDaysRequired: parseInt(form.advanceDaysRequired) || 0,
        sortOrder: parseInt(form.sortOrder) || 0,
        isActive: form.isActive,
      }

      let savedItem: MenuItem

      if (editingItem) {
        // Update existing
        const res = await fetch(`/api/menu/items/${editingItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to update item')
        savedItem = await res.json()
      } else {
        // Create new
        const res = await fetch('/api/menu/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to create item')
        savedItem = await res.json()
      }

      // Upload image if selected
      if (imageFile) {
        await uploadImage(savedItem.id)
      }

      await mutateItems()
      await mutateCategories()
      closeDrawer()
    } catch (error) {
      console.error('Save failed:', error)
      alert(error instanceof Error ? error.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete item ──
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm(t('confirmDeleteItem'))) return
    try {
      const res = await fetch(`/api/menu/items/${itemId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      await mutateItems()
      await mutateCategories()
    } catch (error) {
      console.error('Delete failed:', error)
    }
  }

  // ── Toggle item active ──
  const handleToggleActive = async (item: MenuItem) => {
    try {
      const res = await fetch(`/api/menu/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !item.isActive }),
      })
      if (!res.ok) throw new Error('Failed to toggle')
      await mutateItems()
    } catch (error) {
      console.error('Toggle failed:', error)
    }
  }

  // ── Category CRUD ──
  const openAddCategory = () => {
    setEditingCategory(null)
    setCategoryForm({ nameEn: '', nameZh: '', sortOrder: '0' })
    setCategoryModalOpen(true)
  }

  const openEditCategory = (cat: MenuCategory) => {
    setEditingCategory(cat)
    setCategoryForm({
      nameEn: cat.nameEn,
      nameZh: cat.nameZh || '',
      sortOrder: cat.sortOrder.toString(),
    })
    setCategoryModalOpen(true)
  }

  const handleSaveCategory = async () => {
    if (!categoryForm.nameEn.trim()) return
    setSavingCategory(true)
    try {
      const payload = {
        nameEn: categoryForm.nameEn.trim(),
        nameZh: categoryForm.nameZh.trim() || undefined,
        sortOrder: parseInt(categoryForm.sortOrder) || 0,
      }

      if (editingCategory) {
        const res = await fetch(`/api/menu/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, id: editingCategory.id }),
        })
        if (!res.ok) throw new Error('Failed to update category')
      } else {
        const res = await fetch('/api/menu/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to create category')
        const newCat = await res.json()
        setActiveCategoryId(newCat.id)
      }

      await mutateCategories()
      setCategoryModalOpen(false)
    } catch (error) {
      console.error('Category save failed:', error)
      alert(error instanceof Error ? error.message : 'Save failed')
    } finally {
      setSavingCategory(false)
    }
  }

  const activeCategory = categories.find(c => c.id === activeCategoryId)
  const itemCount = activeCategory?._count?.items ?? items.length

  // ── Loading state ──
  if (status === 'loading') {
    return (
      <>
        <TopBar title={t('title')} />
        <div className="flex-1 flex items-center justify-center bg-cream-bg">
          <div className="text-gray-text">Loading...</div>
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar title={t('title')} />
      <div className="flex-1 flex bg-cream-bg overflow-hidden relative">
        {/* ── Category Sidebar ── */}
        <div className="w-[180px] bg-white border-r border-beige p-4 flex flex-col gap-1 shrink-0">
          <div className="text-sm font-bold text-brown mb-2">{t('categories')}</div>
          {categories.map((cat) => (
            <div
              key={cat.id}
              className={`group flex items-center gap-1 text-sm px-3 py-2 rounded-md cursor-pointer transition-colors ${
                activeCategoryId === cat.id
                  ? 'bg-amber text-white font-semibold'
                  : 'text-brown hover:bg-cream-bg'
              }`}
              onClick={() => setActiveCategoryId(cat.id)}
            >
              <span className="flex-1 truncate">{cat.nameEn}</span>
              <span className={`text-xs ${activeCategoryId === cat.id ? 'text-white/70' : 'text-gray-text'}`}>
                {cat._count?.items ?? 0}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); openEditCategory(cat) }}
                className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 ${
                  activeCategoryId === cat.id ? 'text-white/80 hover:text-white' : 'text-gray-text hover:text-brown'
                }`}
                title={t('editCategory')}
              >
                <Pencil size={12} />
              </button>
            </div>
          ))}
          <button
            onClick={openAddCategory}
            className="text-left text-sm text-amber font-medium px-3 py-2 mt-2 hover:bg-amber-light-bg rounded-md transition-colors"
          >
            {t('addCategory')}
          </button>
        </div>

        {/* ── Main Content ── */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-brown font-playfair">
                {activeCategory?.nameEn || ''}
              </span>
              <span className="text-sm text-gray-text">
                {itemCount} {t('dishes')}
              </span>
            </div>
            <button
              onClick={openAddDrawer}
              className="flex items-center gap-1.5 bg-amber text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-amber/90 transition-colors"
            >
              <Plus size={14} /> {t('addDish')}
            </button>
          </div>

          {/* ── Item Grid ── */}
          <div className="grid grid-cols-3 gap-5">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-beige overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Image */}
                <div className="h-[140px] bg-gray-100 relative overflow-hidden">
                  {item.imageUrl ? (
                    <img
                      src={getSupabasePublicUrl(item.imageUrl)}
                      alt={item.nameEn}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-beige/30">
                      <ImageIcon size={32} className="text-beige" />
                    </div>
                  )}
                  {/* Active toggle pill */}
                  <button
                    onClick={() => handleToggleActive(item)}
                    className={`absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                      item.isActive
                        ? 'bg-green text-white'
                        : 'bg-gray-400 text-white'
                    }`}
                  >
                    {item.isActive ? 'Active' : 'Inactive'}
                  </button>
                  {/* Action buttons */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button
                      onClick={() => openEditDrawer(item)}
                      className="w-7 h-7 bg-white/90 rounded-md flex items-center justify-center hover:bg-white transition-colors"
                    >
                      <Pencil size={12} className="text-brown" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="w-7 h-7 bg-white/90 rounded-md flex items-center justify-center hover:bg-white transition-colors"
                    >
                      <Trash2 size={12} className="text-red" />
                    </button>
                  </div>
                </div>
                {/* Body */}
                <div className="p-4 flex flex-col gap-2">
                  <div className="text-sm font-bold text-brown">{item.nameEn}</div>
                  {item.nameZh && (
                    <div className="text-[13px] text-brown/50">{item.nameZh}</div>
                  )}
                  <div className="text-base font-bold text-amber">
                    ${item.price.toFixed(2)}
                  </div>
                  {item.tags.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getTagClasses(tag)}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Add New Dish Card */}
            <div
              onClick={openAddDrawer}
              className="bg-cream-bg rounded-xl border-2 border-dashed border-beige flex flex-col items-center justify-center min-h-[260px] cursor-pointer hover:border-amber transition-colors"
            >
              <Plus size={24} className="text-amber mb-2" />
              <span className="text-sm font-semibold text-amber">{t('addNewDish')}</span>
            </div>
          </div>
        </div>

        {/* ── Edit/Add Drawer ── */}
        {drawerOpen && (
          <>
            {/* Overlay */}
            <div
              className="absolute inset-0 bg-brown/20 z-10"
              onClick={closeDrawer}
            />
            {/* Drawer */}
            <div className="absolute right-0 top-0 bottom-0 w-[420px] bg-white border-l border-beige flex flex-col z-20 shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-beige">
                <span className="text-base font-bold text-brown">
                  {editingItem ? t('editDish.title') : t('editDish.addTitle')}
                </span>
                <button onClick={closeDrawer} className="hover:bg-cream-bg rounded-md p-1 transition-colors">
                  <X size={20} className="text-gray-text" />
                </button>
              </div>

              {/* Form Body */}
              <div className="flex-1 overflow-auto p-5 flex flex-col gap-4">
                {/* Name EN */}
                <div>
                  <label className="text-xs font-semibold text-brown mb-1 block">
                    {t('editDish.nameEn')}
                  </label>
                  <input
                    className="w-full border border-beige rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber transition-colors"
                    value={form.nameEn}
                    onChange={(e) => updateForm('nameEn', e.target.value)}
                    placeholder="Grilled Lamb Chops"
                  />
                </div>

                {/* Name ZH */}
                <div>
                  <label className="text-xs font-semibold text-brown mb-1 block">
                    {t('editDish.nameZh')}
                  </label>
                  <input
                    className="w-full border border-beige rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber transition-colors"
                    value={form.nameZh}
                    onChange={(e) => updateForm('nameZh', e.target.value)}
                    placeholder="烤羊排"
                  />
                </div>

                {/* Category + Price row */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-brown mb-1 block">
                      {t('editDish.category')}
                    </label>
                    <select
                      className="w-full border border-beige rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber transition-colors bg-white"
                      value={form.categoryId}
                      onChange={(e) => updateForm('categoryId', e.target.value)}
                    >
                      <option value="">--</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.nameEn}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-brown mb-1 block">
                      {t('editDish.price')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full border border-beige rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber transition-colors"
                      value={form.price}
                      onChange={(e) => updateForm('price', e.target.value)}
                      placeholder="28.00"
                    />
                  </div>
                </div>

                {/* Description EN */}
                <div>
                  <label className="text-xs font-semibold text-brown mb-1 block">
                    {t('editDish.descriptionEn')}
                  </label>
                  <textarea
                    className="w-full border border-beige rounded-md px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:border-amber transition-colors"
                    value={form.descriptionEn}
                    onChange={(e) => updateForm('descriptionEn', e.target.value)}
                    placeholder="A tender and perfectly seasoned cut..."
                  />
                </div>

                {/* Description ZH */}
                <div>
                  <label className="text-xs font-semibold text-brown mb-1 block">
                    {t('editDish.descriptionZh')}
                  </label>
                  <textarea
                    className="w-full border border-beige rounded-md px-3 py-2 text-sm h-16 resize-none focus:outline-none focus:border-amber transition-colors"
                    value={form.descriptionZh}
                    onChange={(e) => updateForm('descriptionZh', e.target.value)}
                    placeholder="经典的烤羊排..."
                  />
                </div>

                {/* Image Upload */}
                <div>
                  <label className="text-xs font-semibold text-brown mb-1 block">
                    {t('editDish.image')}
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleImageSelect(file)
                    }}
                  />
                  {imagePreview ? (
                    <div
                      className="relative rounded-md overflow-hidden border border-beige cursor-pointer group"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-[140px] object-cover"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {t('editDish.imageChange')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="border border-dashed border-beige rounded-md p-6 flex flex-col items-center justify-center text-sm text-gray-text gap-2 cursor-pointer hover:border-amber transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                      onDrop={handleDrop}
                      onDragOver={(e) => e.preventDefault()}
                    >
                      <Upload size={20} className="text-beige" />
                      <span>{t('editDish.imageUpload')}</span>
                      <span className="text-[11px] text-muted-beige">JPG, PNG, WebP (max 5MB)</span>
                    </div>
                  )}
                  {uploading && (
                    <div className="mt-1 text-xs text-amber">{t('editDish.uploading')}</div>
                  )}
                </div>

                {/* Tags */}
                <div>
                  <label className="text-xs font-semibold text-brown mb-1 block">
                    {t('editDish.tags')}
                  </label>
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {form.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`text-[10px] font-medium pl-2 pr-1 py-0.5 rounded-full flex items-center gap-1 ${getTagClasses(tag)}`}
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="w-3 h-3 flex items-center justify-center rounded-full hover:bg-black/10"
                        >
                          <X size={8} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 border border-beige rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-amber transition-colors"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addTag()
                        }
                      }}
                      placeholder={t('editDish.tagPlaceholder')}
                    />
                    <button
                      onClick={addTag}
                      className="text-xs text-amber font-medium px-2 py-1 border border-amber/30 rounded-md hover:bg-amber-light-bg transition-colors"
                    >
                      {t('editDish.addTag')}
                    </button>
                  </div>
                </div>

                {/* Advance Days + Sort Order row */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-brown mb-1 block">
                      {t('editDish.advanceOrder')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="w-full border border-beige rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber transition-colors"
                      value={form.advanceDaysRequired}
                      onChange={(e) => updateForm('advanceDaysRequired', e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-brown mb-1 block">
                      {t('editDish.sortOrder')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="w-full border border-beige rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber transition-colors"
                      value={form.sortOrder}
                      onChange={(e) => updateForm('sortOrder', e.target.value)}
                    />
                  </div>
                </div>

                {/* Is Active toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-brown">{t('editDish.active')}</span>
                  <button
                    onClick={() => updateForm('isActive', !form.isActive)}
                    className={`w-10 h-5 rounded-full flex items-center transition-colors ${
                      form.isActive ? 'bg-green justify-end' : 'bg-gray-300 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 bg-white rounded-full mx-0.5 shadow-sm" />
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-beige flex justify-end gap-3">
                <button
                  onClick={closeDrawer}
                  className="px-4 py-2 text-sm text-brown border border-beige rounded-md hover:bg-cream-bg transition-colors"
                >
                  {t('editDish.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.nameEn.trim() || !form.categoryId || !form.price}
                  className="px-4 py-2 text-sm bg-amber text-white font-semibold rounded-md hover:bg-amber/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? t('saving') : t('editDish.saveChanges')}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Category Modal ── */}
        {categoryModalOpen && (
          <>
            <div
              className="absolute inset-0 bg-brown/20 z-30"
              onClick={() => setCategoryModalOpen(false)}
            />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] bg-white rounded-xl shadow-xl z-40 border border-beige">
              <div className="flex items-center justify-between p-5 border-b border-beige">
                <span className="text-base font-bold text-brown">
                  {editingCategory ? t('editCategory') : t('addCategory')}
                </span>
                <button
                  onClick={() => setCategoryModalOpen(false)}
                  className="hover:bg-cream-bg rounded-md p-1 transition-colors"
                >
                  <X size={18} className="text-gray-text" />
                </button>
              </div>
              <div className="p-5 flex flex-col gap-4">
                <div>
                  <label className="text-xs font-semibold text-brown mb-1 block">
                    {t('categoryName')}
                  </label>
                  <input
                    className="w-full border border-beige rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber transition-colors"
                    value={categoryForm.nameEn}
                    onChange={(e) => setCategoryForm(prev => ({ ...prev, nameEn: e.target.value }))}
                    placeholder="Mains"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-brown mb-1 block">
                    {t('categoryNameZh')}
                  </label>
                  <input
                    className="w-full border border-beige rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber transition-colors"
                    value={categoryForm.nameZh}
                    onChange={(e) => setCategoryForm(prev => ({ ...prev, nameZh: e.target.value }))}
                    placeholder="主菜"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-brown mb-1 block">
                    {t('categorySortOrder')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-beige rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber transition-colors"
                    value={categoryForm.sortOrder}
                    onChange={(e) => setCategoryForm(prev => ({ ...prev, sortOrder: e.target.value }))}
                  />
                </div>
              </div>
              <div className="p-5 pt-0 flex justify-end gap-3">
                <button
                  onClick={() => setCategoryModalOpen(false)}
                  className="px-4 py-2 text-sm text-brown border border-beige rounded-md hover:bg-cream-bg transition-colors"
                >
                  {t('editDish.cancel')}
                </button>
                <button
                  onClick={handleSaveCategory}
                  disabled={savingCategory || !categoryForm.nameEn.trim()}
                  className="px-4 py-2 text-sm bg-amber text-white font-semibold rounded-md hover:bg-amber/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingCategory ? t('saving') : t('editDish.saveChanges')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
