'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import useSWR from 'swr'
import Image from 'next/image'
import {
  ArrowLeft,
  Minus,
  Plus,
  Loader2,
  UtensilsCrossed,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────

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
  category: MenuCategory
}

interface OrderItem {
  menuItemId: string
  quantity: number
  menuItem?: {
    id: string
    nameEn: string
    nameZh: string | null
    price: number
  }
}

interface AdminOrderEditorProps {
  reservationId: string
  /** Customer name to display in the header */
  customerName?: string
  existingOrder?: {
    id: string
    items: OrderItem[]
    notes: string | null
  } | null
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

// ── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Fetch failed')
    return r.json()
  })

// ── Skeleton loaders ───────────────────────────────────────────────

function TabsSkeleton() {
  return (
    <div className="flex gap-2 overflow-hidden px-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-9 w-20 rounded-full bg-[#E8ECE4] animate-pulse shrink-0"
        />
      ))}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl p-4 border border-[#E8ECE4] flex gap-3"
        >
          <div className="w-[56px] h-[56px] rounded-lg bg-[#E8ECE4] animate-pulse shrink-0" />
          <div className="flex flex-col gap-2 flex-1">
            <div className="h-4 w-3/4 bg-[#E8ECE4] animate-pulse rounded" />
            <div className="h-3 w-1/2 bg-[#E8ECE4] animate-pulse rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────

export default function AdminOrderEditor({
  reservationId,
  customerName,
  existingOrder,
  isOpen,
  onClose,
  onSaved,
}: AdminOrderEditorProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  // ── Data fetching ───────────────────────────────────────────────

  const { data: categories } = useSWR<MenuCategory[]>(
    isOpen ? '/api/menu/categories' : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  const { data: menuItems } = useSWR<MenuItem[]>(
    isOpen ? '/api/menu/items?activeOnly=true' : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  // ── Active category ─────────────────────────────────────────────

  const effectiveCategoryId =
    activeCategoryId ||
    (categories && categories.length > 0 ? categories[0].id : null)

  // ── Pre-fill from existing order ────────────────────────────────

  useEffect(() => {
    if (existingOrder && !initialized) {
      const qtyMap: Record<string, number> = {}
      for (const item of existingOrder.items) {
        qtyMap[item.menuItemId] = item.quantity
      }
      setQuantities(qtyMap)
      setNotes(existingOrder.notes || '')
      setInitialized(true)
    }
  }, [existingOrder, initialized])

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setInitialized(false)
      setActiveCategoryId(null)
      setQuantities({})
      setNotes('')
      setError(null)
      setSubmitting(false)
    }
  }, [isOpen])

  // ── Escape key ──────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // ── Filter items by category ────────────────────────────────────

  const filteredItems = useMemo(() => {
    if (!menuItems || !effectiveCategoryId) return []
    return menuItems.filter(
      (item) => item.categoryId === effectiveCategoryId
    )
  }, [menuItems, effectiveCategoryId])

  // ── Quantity helpers ────────────────────────────────────────────

  const updateQty = useCallback((itemId: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] || 0) + delta),
    }))
  }, [])

  // ── Order computation ───────────────────────────────────────────

  const orderSummary = useMemo(() => {
    if (!menuItems) return { subtotal: 0, itemCount: 0, dishCount: 0 }
    let subtotal = 0
    let itemCount = 0
    let dishCount = 0
    for (const [itemId, qty] of Object.entries(quantities)) {
      if (qty <= 0) continue
      const item = menuItems.find((i) => i.id === itemId)
      if (!item) continue
      subtotal += item.price * qty
      itemCount += qty
      dishCount++
    }
    return { subtotal, itemCount, dishCount }
  }, [quantities, menuItems])

  // ── Submit handler ──────────────────────────────────────────────

  const handleSave = async () => {
    if (submitting) return
    setSubmitting(true)
    setError(null)

    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([menuItemId, quantity]) => ({ menuItemId, quantity }))

    try {
      if (existingOrder) {
        // Update existing order
        const res = await fetch(`/api/orders/${existingOrder.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'admin-edit',
            items,
            notes: notes.trim() || null,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to update order')
        }
      } else {
        // Create new order
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservationId,
            items,
            notes: notes.trim() || null,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to create order')
        }
      }

      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Display helpers ─────────────────────────────────────────────

  const displayName = (item: { nameEn: string; nameZh: string | null }) =>
    item.nameZh || item.nameEn

  const categoryName = (cat: { nameEn: string; nameZh: string | null }) =>
    cat.nameZh || cat.nameEn

  // ── Render ──────────────────────────────────────────────────────

  if (!isOpen) return null

  const isEdit = !!existingOrder
  const headerTitle = customerName
    ? `${isEdit ? '编辑' : '为'} ${customerName} ${isEdit ? '的订单' : '点单'}`
    : isEdit
      ? '编辑订单'
      : '代客点单'

  return (
    <div className="fixed inset-0 z-50 bg-[#F8F7F4] flex flex-col">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="h-14 bg-white border-b border-[#E8ECE4] flex items-center px-4 shrink-0">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#E8ECE4]/40 transition-colors shrink-0"
        >
          <ArrowLeft size={20} className="text-[#3D2B1F]" />
        </button>
        <h1 className="ml-3 font-serif text-lg text-[#3D2B1F] truncate">
          {headerTitle}
        </h1>
      </div>

      {/* ── Category Tabs ──────────────────────────────────────── */}
      <div className="bg-[#F8F7F4] border-b border-[#E8ECE4] py-3 shrink-0">
        {!categories ? (
          <TabsSkeleton />
        ) : (
          <div className="flex gap-2 overflow-x-auto px-4 hide-scrollbar">
            {categories.map((cat) => {
              const isActive = cat.id === effectiveCategoryId
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategoryId(cat.id)}
                  className={`flex items-center rounded-full px-4 py-2 text-sm whitespace-nowrap shrink-0 transition-colors duration-200 border ${
                    isActive
                      ? 'bg-[#6B7F5E] text-white border-[#6B7F5E]'
                      : 'bg-transparent border-[#6B7F5E]/20 text-[#3D2B1F] hover:bg-[#6B7F5E]/10'
                  }`}
                >
                  {categoryName(cat)}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Menu Items ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {!menuItems ? (
          <ListSkeleton />
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <UtensilsCrossed
              size={28}
              className="text-[#8C8478]"
              strokeWidth={1.5}
            />
            <p className="text-[#8C8478] text-sm">该分类暂无菜品</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            {filteredItems.map((item) => {
              const qty = quantities[item.id] || 0
              const name = displayName(item)

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl p-4 border border-[#E8ECE4] flex gap-3"
                >
                  {/* Image */}
                  <div className="w-[56px] h-[56px] rounded-lg overflow-hidden shrink-0 bg-[#F2EDE6] flex items-center justify-center">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={name}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <UtensilsCrossed
                        size={20}
                        className="text-[#8C8478]"
                        strokeWidth={1.5}
                      />
                    )}
                  </div>

                  {/* Info + Controls */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-serif text-[15px] text-[#3D2B1F] leading-snug truncate">
                          {name}
                        </p>
                        {item.nameZh && item.nameEn && (
                          <p className="text-[13px] text-[#8C8478] leading-snug truncate">
                            {item.nameEn}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {(item.descriptionZh || item.descriptionEn) && (
                      <p className="text-[12px] text-[#8C8478] leading-snug line-clamp-1">
                        {item.descriptionZh || item.descriptionEn}
                      </p>
                    )}

                    {/* Price + Advance notice + Qty Controls */}
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[#C47D52] font-semibold text-[15px]">
                          ${Math.round(item.price)}
                        </span>
                        {item.advanceDaysRequired > 0 && (
                          <span className="text-[11px] text-[#8B6914] bg-[#8B6914]/10 px-1.5 py-0.5 rounded">
                            需提前{item.advanceDaysRequired}天预订
                          </span>
                        )}
                      </div>

                      {/* Quantity controls */}
                      <div className="flex items-center gap-1">
                        {qty > 0 ? (
                          <>
                            <button
                              onClick={() => updateQty(item.id, -1)}
                              className="w-8 h-8 rounded-full border border-[#E8ECE4] flex items-center justify-center hover:bg-[#E8ECE4]/40 transition-colors"
                            >
                              <Minus size={14} className="text-[#6B7F5E]" />
                            </button>
                            <span className="w-8 text-center text-[15px] font-semibold text-[#3D2B1F]">
                              {qty}
                            </span>
                            <button
                              onClick={() => updateQty(item.id, 1)}
                              className="w-8 h-8 rounded-full border border-[#E8ECE4] bg-[#6B7F5E] flex items-center justify-center hover:bg-[#5A6D4F] transition-colors"
                            >
                              <Plus size={14} className="text-white" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => updateQty(item.id, 1)}
                            className="w-8 h-8 rounded-full border border-[#E8ECE4] bg-[#6B7F5E] flex items-center justify-center hover:bg-[#5A6D4F] transition-colors"
                          >
                            <Plus size={14} className="text-white" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Bottom Bar ─────────────────────────────────────────── */}
      <div className="bg-white border-t border-[#E8ECE4] p-4 shrink-0 space-y-3">
        {/* Notes */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-[#8C8478] shrink-0">备注:</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="特殊要求、过敏信息等"
            className="flex-1 h-9 rounded-lg border border-[#E8ECE4] px-3 text-sm text-[#3D2B1F] placeholder:text-[#BFBFBF] focus:border-[#6B7F5E] focus:outline-none transition-colors bg-[#F8F7F4]"
          />
        </div>

        {/* Subtotal */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#8C8478]">
            小计: ${Math.round(orderSummary.subtotal)}
            {orderSummary.dishCount > 0 && (
              <span className="ml-1">
                ({orderSummary.dishCount} 道菜,{' '}
                {orderSummary.itemCount} 份)
              </span>
            )}
          </span>
          {orderSummary.subtotal > 0 && (
            <span className="text-lg font-bold text-[#C47D52]">
              ${Math.round(orderSummary.subtotal)}
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Save button */}
        <button
          disabled={orderSummary.dishCount === 0 || submitting}
          onClick={handleSave}
          className="w-full py-3 rounded-full bg-[#6B7F5E] text-white text-[15px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#5A6D4F] transition-colors flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 size={18} className="animate-spin" />}
          {submitting
            ? '保存中...'
            : isEdit
              ? '更新订单'
              : '保存订单'}
        </button>
      </div>
    </div>
  )
}
