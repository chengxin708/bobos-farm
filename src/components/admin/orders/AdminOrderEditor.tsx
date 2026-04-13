'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
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

const CATEGORY_EMOJIS: Record<string, string> = {
  'Whole Lamb': '\u{1F411}',
  'Signature Dishes': '\u{1F372}',
  'Iron Pot Stews': '\u{1F958}',
  'Cold Dishes': '\u{1F957}',
  'Staples': '\u{1F35A}',
  'Beverages': '\u{1F964}',
}

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
  const t = useTranslations('admin.orders')
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  // Section refs for scroll + IntersectionObserver
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const navRef = useRef<HTMLDivElement>(null)
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isScrollingRef = useRef(false)

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

  // ── Group items by category ─────────────────────────────────────

  const groupedItems = useMemo(() => {
    if (!menuItems || !categories) return []
    const map = new Map<string, MenuItem[]>()
    for (const item of menuItems) {
      const list = map.get(item.categoryId) || []
      list.push(item)
      map.set(item.categoryId, list)
    }
    return categories
      .filter(cat => map.has(cat.id))
      .map(cat => ({ category: cat, items: map.get(cat.id)! }))
  }, [menuItems, categories])

  // Resolve activeTabId
  const resolvedTabId = activeTabId ?? (groupedItems[0]?.category.id ?? null)

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
      setActiveTabId(null)
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

  // ── IntersectionObserver ────────────────────────────────────────

  useEffect(() => {
    if (groupedItems.length === 0 || !scrollContainerRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingRef.current) return
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const catId = entry.target.getAttribute('data-category-id')
            if (catId) setActiveTabId(catId)
          }
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '-80px 0px -60% 0px',
        threshold: 0,
      }
    )

    const refs = sectionRefs.current
    for (const el of Object.values(refs)) {
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [groupedItems])

  // Scroll active pill into view
  useEffect(() => {
    if (!resolvedTabId || !pillRefs.current[resolvedTabId] || !navRef.current) return
    const pill = pillRefs.current[resolvedTabId]!
    const nav = navRef.current
    const scrollTarget = pill.offsetLeft - nav.offsetWidth / 2 + pill.offsetWidth / 2
    nav.scrollTo({ left: scrollTarget, behavior: 'smooth' })
  }, [resolvedTabId])

  // Scroll to a category section
  const scrollToCategory = useCallback((categoryId: string) => {
    setActiveTabId(categoryId)
    const el = sectionRefs.current[categoryId]
    if (!el) return
    isScrollingRef.current = true
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setTimeout(() => { isScrollingRef.current = false }, 800)
  }, [])

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
    ? (isEdit ? t('editorTitleEdit', { name: customerName }) : t('editorTitle', { name: customerName }))
    : isEdit
      ? t('editOrder')
      : t('placeOrder')

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

      {/* ── Category Nav — sticky ──────────────────────────────── */}
      <div className="bg-[#F8F7F4]/95 backdrop-blur-sm border-b border-[#E8ECE4] py-3 shrink-0">
        {!categories ? (
          <TabsSkeleton />
        ) : (
          <div ref={navRef} className="flex gap-2 overflow-x-auto px-4 hide-scrollbar">
            {groupedItems.map(({ category: cat }) => {
              const isActive = cat.id === resolvedTabId
              const emoji = CATEGORY_EMOJIS[cat.nameEn] ?? ''
              return (
                <button
                  key={cat.id}
                  ref={(el) => { pillRefs.current[cat.id] = el }}
                  onClick={() => scrollToCategory(cat.id)}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm whitespace-nowrap shrink-0 transition-colors duration-200 border ${
                    isActive
                      ? 'bg-[#6B7F5E] text-white border-[#6B7F5E]'
                      : 'bg-transparent border-[#6B7F5E]/20 text-[#3D2B1F] hover:bg-[#6B7F5E]/10'
                  }`}
                >
                  {emoji && <span>{emoji}</span>}
                  <span>{categoryName(cat)}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Waterfall Menu Items ───────────────────────────────── */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        {!menuItems ? (
          <ListSkeleton />
        ) : groupedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <UtensilsCrossed
              size={28}
              className="text-[#8C8478]"
              strokeWidth={1.5}
            />
            <p className="text-[#8C8478] text-sm">{t('noItems')}</p>
          </div>
        ) : (
          groupedItems.map(({ category: cat, items }) => {
            const emoji = CATEGORY_EMOJIS[cat.nameEn] ?? ''
            return (
              <div
                key={cat.id}
                ref={(el) => { sectionRefs.current[cat.id] = el }}
                data-category-id={cat.id}
                className="scroll-mt-2"
              >
                {/* Section header */}
                <div className="flex items-center gap-2 px-4 pt-5 pb-2">
                  <span className="text-lg">{emoji}</span>
                  <h2 className="font-serif text-lg text-[#1A1208]">{categoryName(cat)}</h2>
                  <div className="flex-1 h-px bg-[#E8E2D9] ml-2" />
                </div>

                {/* Items */}
                <div className="flex flex-col gap-3 px-4 pb-2">
                  {items.map((item) => {
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
                                  {t('advanceNotice', { days: item.advanceDaysRequired })}
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
              </div>
            )
          })
        )}
      </div>

      {/* ── Bottom Bar ─────────────────────────────────────────── */}
      <div className="bg-white border-t border-[#E8ECE4] p-4 shrink-0 space-y-3">
        {/* Notes */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-[#8C8478] shrink-0">{t('notes')}:</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('notesPlaceholder')}
            className="flex-1 h-9 rounded-lg border border-[#E8ECE4] px-3 text-sm text-[#3D2B1F] placeholder:text-[#BFBFBF] focus:border-[#6B7F5E] focus:outline-none transition-colors bg-[#F8F7F4]"
          />
        </div>

        {/* Subtotal */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#8C8478]">
            {t('subtotal')}: ${Math.round(orderSummary.subtotal)}
            {orderSummary.dishCount > 0 && (
              <span className="ml-1">
                ({t('dishes', { count: orderSummary.dishCount, qty: orderSummary.itemCount })})
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
            ? t('saving')
            : isEdit
              ? t('updateOrder')
              : t('saveOrder')}
        </button>
      </div>
    </div>
  )
}
