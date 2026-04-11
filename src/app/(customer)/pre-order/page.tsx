"use client"

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import useSWR from 'swr'
import Image from 'next/image'
import {
  ArrowLeft,
  Search,
  Minus,
  Plus,
  X,
  ShoppingCart,
  ChevronUp,
  ChevronDown,
  UtensilsCrossed,
  Calendar,
  Users,
  MapPin,
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
  id: string
  menuItemId: string
  quantity: number
  menuItem: {
    id: string
    nameEn: string
    nameZh: string | null
    price: number
    imageUrl: string | null
  }
}

interface Order {
  id: string
  status: string
  notes: string | null
  estimatedTotal: number | null
  submittedAt: string | null
  updatedAt: string
  items: OrderItem[]
}

interface ReservationYurt {
  id: string
  name: string
  capacity: number
}

interface Reservation {
  id: string
  date: string
  guestCount: number
  status: string
  yurt: ReservationYurt
  order: Order | null
}

// ── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

const TAG_LABELS: Record<string, string> = {
  'signature':     'Signature',
  'advance-order': 'Pre-order',
  'popular':       'Popular',
  'vegetarian':    'Vegetarian',
  'gluten-free':   'GF',
  'non-alcoholic': 'N/A',
  'must try':      'Must Try',
  'homemade':      'Homemade',
  'farm fresh':    'Farm Fresh',
  'spicy':         'Spicy',
}

// ── Skeleton loaders ───────────────────────────────────────────────

function TabsSkeleton() {
  return (
    <div className="flex gap-2 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-9 w-20 rounded-full skeleton-pulse shrink-0" />
      ))}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 py-3.5 px-4 border-b border-[#F2EDE6]">
          <div className="w-[60px] h-[60px] rounded-xl skeleton-pulse shrink-0" />
          <div className="flex flex-col gap-2 flex-1">
            <div className="h-4 w-3/4 skeleton-pulse rounded" />
            <div className="h-3 w-full skeleton-pulse rounded" />
            <div className="h-4 w-14 skeleton-pulse rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────

export default function PreOrderPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center bg-[#F8F7F4]">
        <p className="text-[#8C8478]">Loading...</p>
      </div>
    }>
      <PreOrderPage />
    </Suspense>
  )
}

function PreOrderPage() {
  const t = useTranslations('preOrder')
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const reservationId = searchParams.get('reservationId')

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [notes, setNotes] = useState('')
  const [submittingOrder, setSubmittingOrder] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [sheetExpanded, setSheetExpanded] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Fetch categories and menu items
  const { data: categories } = useSWR<MenuCategory[]>('/api/menu/categories', fetcher, {
    revalidateOnFocus: false, dedupingInterval: 60000,
  })
  const { data: menuItems } = useSWR<MenuItem[]>('/api/menu/items?activeOnly=true', fetcher, {
    revalidateOnFocus: false, dedupingInterval: 60000,
  })

  // Fetch reservation (includes order if exists)
  const { data: reservation, mutate: mutateReservation } = useSWR<Reservation>(
    reservationId ? `/api/reservations/${reservationId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  // Detect edit mode
  const existingOrder = reservation?.order ?? null
  const isEditMode = !!existingOrder

  // Pre-fill quantities and notes from existing order (once)
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

  // Derive active category
  const effectiveCategoryId = activeCategoryId || (categories && categories.length > 0 ? categories[0].id : null)

  // Filter items by category and search
  const filteredItems = useMemo(() => {
    if (!menuItems) return []
    let items = menuItems
    if (effectiveCategoryId && !searchTerm.trim()) {
      items = items.filter(item => item.categoryId === effectiveCategoryId)
    }
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase()
      items = items.filter(item =>
        item.nameEn.toLowerCase().includes(lower) ||
        (item.nameZh && item.nameZh.includes(searchTerm)) ||
        (item.descriptionEn && item.descriptionEn.toLowerCase().includes(lower))
      )
    }
    return items
  }, [menuItems, effectiveCategoryId, searchTerm])

  // Order computation
  const orderItems = useMemo(() => {
    if (!menuItems) return []
    return Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const item = menuItems.find(i => i.id === itemId)
        if (!item) return null
        return {
          id: itemId,
          nameEn: item.nameEn,
          nameZh: item.nameZh,
          qty,
          price: item.price,
          total: item.price * qty,
        }
      })
      .filter(Boolean) as { id: string; nameEn: string; nameZh: string | null; qty: number; price: number; total: number }[]
  }, [quantities, menuItems])

  const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0)
  const totalItems = orderItems.reduce((sum, item) => sum + item.qty, 0)

  const updateQty = useCallback((itemId: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] || 0) + delta),
    }))
  }, [])

  const removeItem = useCallback((itemId: string) => {
    setQuantities(prev => ({ ...prev, [itemId]: 0 }))
  }, [])

  // Display name helpers
  const displayName = (item: { nameEn: string; nameZh: string | null }) =>
    locale === 'zh' && item.nameZh ? item.nameZh : item.nameEn

  const secondaryName = (item: { nameEn: string; nameZh: string | null }) =>
    locale === 'zh' ? item.nameEn : (item.nameZh ?? '')

  const itemDescription = (item: MenuItem) =>
    locale === 'zh' && item.descriptionZh ? item.descriptionZh : (item.descriptionEn ?? '')

  // Format reservation info
  const resDate = reservation
    ? new Date(reservation.date).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      })
    : ''
  const resYurt = reservation?.yurt?.name || ''
  const resGuests = reservation?.guestCount?.toString() || ''

  // Submit / Update handler
  const handleSubmit = async () => {
    if (submittingOrder || orderItems.length === 0) return
    setSubmittingOrder(true)
    setOrderError(null)

    try {
      if (isEditMode && existingOrder) {
        // PATCH existing order
        const res = await fetch(`/api/orders/${existingOrder.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: orderItems.map(i => ({ menuItemId: i.id, quantity: i.qty })),
            notes: notes.trim() || undefined,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to update order')
        }
      } else {
        // POST new order
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservationId,
            items: orderItems.map(i => ({ menuItemId: i.id, quantity: i.qty })),
            notes: notes.trim() || undefined,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to submit order')
        }
      }

      setOrderSuccess(true)
      // Re-fetch reservation to get updated order
      await mutateReservation()
      // Collapse sheet after success
      setTimeout(() => setSheetExpanded(false), 1500)
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Failed to submit order')
    } finally {
      setSubmittingOrder(false)
    }
  }

  // Last updated display
  const lastUpdatedText = existingOrder?.updatedAt
    ? new Date(existingOrder.updatedAt).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <div className="flex flex-col flex-1 bg-[#F8F7F4] pb-4">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-[#F8F7F4] border-b border-[#F2EDE6]">
        {/* Title bar */}
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.push('/reservations')}
            className="w-9 h-9 rounded-full bg-transparent border border-[#E8E2D9] flex items-center justify-center cursor-pointer shrink-0"
          >
            <ArrowLeft size={18} color="#1A1208" />
          </button>
          <h1 className="font-serif text-xl text-[#1A1208] flex-1">
            {isEditMode ? t('editTitle') : t('title')}
          </h1>
        </div>

        {/* Reservation info bar */}
        {reservation && (
          <div className="flex items-center gap-4 px-4 pb-3 text-[13px] text-[#8C8478]">
            <span className="flex items-center gap-1">
              <Calendar size={14} className="text-[#6B7F5E]" />
              {resDate}
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={14} className="text-[#6B7F5E]" />
              {resYurt}
            </span>
            <span className="flex items-center gap-1">
              <Users size={14} className="text-[#6B7F5E]" />
              {resGuests}
            </span>
          </div>
        )}
      </div>

      {/* ── Category Tabs ─────────────────────────────────────── */}
      <div className="sticky top-[104px] z-20 bg-[#F8F7F4] px-4 py-3 border-b border-[#F2EDE6]">
        {!categories ? (
          <TabsSkeleton />
        ) : (
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {categories.map((cat) => {
              const isActive = cat.id === effectiveCategoryId
              const catName = locale === 'zh' && cat.nameZh ? cat.nameZh : cat.nameEn
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategoryId(cat.id)
                    setSearchTerm('')
                  }}
                  className={`flex items-center rounded-full px-4 py-2 text-sm whitespace-nowrap shrink-0 cursor-pointer border transition-colors duration-200 ${
                    isActive
                      ? 'bg-[#6B7F5E] text-white border-[#6B7F5E]'
                      : 'bg-transparent border-[#6B7F5E]/20 text-[#1A1208]'
                  }`}
                >
                  {catName}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Search Bar ────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center gap-2.5 h-11 px-3.5 bg-white rounded-full border border-[#E8E2D9] focus-within:border-[#6B7F5E] transition-colors">
          <Search size={18} className="text-[#8C8478] shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="flex-1 bg-transparent border-none outline-none text-sm text-[#1A1208] placeholder:text-[#BFBFBF]"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-[#8C8478] bg-transparent border-none cursor-pointer p-0">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ── Item List ─────────────────────────────────────────── */}
      <div className="flex flex-col">
        {!menuItems ? (
          <ListSkeleton />
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <UtensilsCrossed size={28} color="#8C8478" strokeWidth={1.5} />
            <p className="text-[#8C8478] text-sm">{t('noItems')}</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const qty = quantities[item.id] || 0
            const name = displayName(item)
            const secondary = secondaryName(item)
            const desc = itemDescription(item)

            return (
              <div
                key={item.id}
                className="flex gap-3 py-3.5 px-4 border-b border-[#F2EDE6]"
              >
                {/* Image */}
                <div className="w-[60px] h-[60px] rounded-xl overflow-hidden shrink-0 bg-[#F2EDE6] flex items-center justify-center">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={name}
                      width={60}
                      height={60}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UtensilsCrossed size={22} color="#8C8478" strokeWidth={1.5} />
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="font-serif text-[15px] text-[#1A1208] leading-snug truncate">
                    {name}
                  </span>
                  {secondary && (
                    <span className="text-[13px] text-[#8C8478] leading-snug truncate">
                      {secondary}
                    </span>
                  )}
                  {desc && (
                    <span className="text-[13px] text-[#8C8478] leading-snug line-clamp-2 mt-0.5">
                      {desc}
                    </span>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[#C47D52] font-medium text-[14px]">
                      ${Math.round(item.price)}
                    </span>
                    {item.tags.map((tag) => {
                      const label = TAG_LABELS[tag] || TAG_LABELS[tag.toLowerCase()]
                      if (!label) return null
                      return (
                        <span
                          key={tag}
                          className="rounded-full px-2 py-0.5 text-[11px] bg-[#E8ECE4] text-[#6B7F5E]"
                        >
                          {label}
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center shrink-0 self-center">
                  {qty > 0 ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        className="w-8 h-8 rounded-full bg-[#E8ECE4] flex items-center justify-center cursor-pointer border-none"
                      >
                        <Minus size={14} className="text-[#6B7F5E]" />
                      </button>
                      <span className="w-8 text-center text-[15px] font-semibold text-[#1A1208]">
                        {qty}
                      </span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        className="w-8 h-8 rounded-full bg-[#6B7F5E] flex items-center justify-center cursor-pointer border-none"
                      >
                        <Plus size={14} className="text-white" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => updateQty(item.id, 1)}
                      className="w-8 h-8 rounded-full bg-[#6B7F5E] flex items-center justify-center cursor-pointer border-none"
                    >
                      <Plus size={14} className="text-white" />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Bottom Sheet ──────────────────────────────────────── */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          {/* Backdrop when expanded */}
          {sheetExpanded && (
            <div
              className="fixed inset-0 bg-black/20 z-[-1]"
              onClick={() => setSheetExpanded(false)}
            />
          )}

          <div
            className="bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.10)] max-h-[80vh] flex flex-col"
            style={{ transition: 'max-height 0.3s ease' }}
          >
            {/* Collapsed bar */}
            <button
              onClick={() => setSheetExpanded(!sheetExpanded)}
              className="w-full flex items-center justify-between px-5 py-4 bg-[#6B7F5E] rounded-t-2xl cursor-pointer border-none"
            >
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-white" />
                <span className="text-white text-sm font-medium">
                  {t('items', { count: totalItems })} &middot; ${Math.round(subtotal)}
                </span>
              </div>
              {sheetExpanded ? (
                <ChevronDown size={20} className="text-white" />
              ) : (
                <ChevronUp size={20} className="text-white" />
              )}
            </button>

            {/* Expanded content */}
            {sheetExpanded && (
              <div className="flex flex-col overflow-y-auto px-5 pb-5">
                {/* Section title */}
                <div className="flex items-center justify-between py-4 border-b border-[#F2EDE6]">
                  <h3 className="font-serif text-lg text-[#1A1208]">{t('yourOrder')}</h3>
                  {isEditMode && lastUpdatedText && (
                    <span className="text-[12px] text-[#8C8478]">
                      {t('lastUpdated', { date: lastUpdatedText })}
                    </span>
                  )}
                </div>

                {/* Items list */}
                <div className="flex flex-col">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-3 border-b border-[#F2EDE6]">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-sm text-[#1A1208] truncate">
                          {locale === 'zh' && item.nameZh ? item.nameZh : item.nameEn}
                        </span>
                        <span className="text-sm text-[#6B7F5E] font-medium shrink-0">x{item.qty}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-medium text-[#1A1208]">${Math.round(item.total)}</span>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="w-6 h-6 rounded-full bg-[#F2EDE6] flex items-center justify-center border-none cursor-pointer"
                        >
                          <X size={12} className="text-[#8C8478]" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Kitchen Notes */}
                <div className="flex flex-col gap-2 pt-4">
                  <span className="text-[13px] font-medium text-[#1A1208]">{t('kitchenNotes')}</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('kitchenNotesPlaceholder')}
                    className="h-20 px-3.5 py-3 bg-[#F8F7F4] rounded-xl border border-[#E8E2D9] text-[13px] resize-none outline-none placeholder:text-[#BFBFBF] text-[#1A1208] focus:border-[#6B7F5E] transition-colors"
                  />
                </div>

                {/* Estimated Total */}
                <div className="flex items-center justify-between pt-4 pb-2">
                  <span className="font-serif text-base text-[#1A1208]">{t('estimatedTotal')}</span>
                  <span className="font-serif text-xl font-bold text-[#C47D52]">${Math.round(subtotal)}</span>
                </div>

                {/* Error */}
                {orderError && (
                  <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-2.5 mt-1">
                    {orderError}
                  </div>
                )}

                {/* Success */}
                {orderSuccess && (
                  <div className="bg-[#E8ECE4] text-[#6B7F5E] text-sm rounded-xl px-4 py-2.5 mt-1">
                    {isEditMode ? t('orderUpdated') : t('orderSubmitted')}
                  </div>
                )}

                {/* Submit / Update Button */}
                <button
                  disabled={orderItems.length === 0 || submittingOrder || orderSuccess}
                  onClick={handleSubmit}
                  className="h-[48px] rounded-full bg-[#6B7F5E] text-white text-[15px] font-semibold border-none cursor-pointer w-full mt-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors hover:bg-[#5A6D4F]"
                >
                  {submittingOrder
                    ? (isEditMode ? t('updating') : t('submitting'))
                    : orderSuccess
                      ? (isEditMode ? t('orderUpdated') : t('orderSubmitted'))
                      : (isEditMode ? t('updateOrder') : t('submitOrder'))
                  }
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
