"use client"

import { useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import { Calendar, Timer, Search, Minus, Plus, X, ShoppingCart } from 'lucide-react'

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
}

// ── Helpers ────────────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

const TAG_STYLES: Record<string, { color: string; bg: string }> = {
  'signature': { color: '#8B6914', bg: '#FEF3CD' },
  'must try': { color: '#C0392B', bg: '#FFE0E0' },
  'homemade': { color: '#5B8C3E', bg: '#EAF2E3' },
  'farm fresh': { color: '#5B8C3E', bg: '#EAF2E3' },
  'drinks': { color: '#7B2D8E', bg: '#E8D5F5' },
  'sides': { color: '#8B6914', bg: '#FEF3CD' },
  'spicy': { color: '#C0392B', bg: '#FFE0E0' },
}

function getTagStyle(tag: string): { color: string; bg: string } {
  const key = tag.toLowerCase().replace(/[^a-z\s]/g, '').trim()
  return TAG_STYLES[key] || { color: '#8B6914', bg: '#FEF3CD' }
}

// ── Component ──────────────────────────────────────────────────────

export default function PreOrderPageWrapper() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center bg-cream"><p className="text-gray-text">Loading...</p></div>}>
      <PreOrderPage />
    </Suspense>
  )
}

function PreOrderPage() {
  const t = useTranslations('preOrder')
  const searchParams = useSearchParams()
  const reservationId = searchParams.get('reservationId')

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [notes, setNotes] = useState('')

  // Fetch categories and menu items
  const { data: categories } = useSWR<MenuCategory[]>('/api/menu/categories', fetcher)
  const { data: menuItems } = useSWR<MenuItem[]>('/api/menu/items?activeOnly=true', fetcher)

  // Fetch reservation if ID provided
  const { data: reservation } = useSWR<Reservation>(
    reservationId ? `/api/reservations/${reservationId}` : null,
    fetcher
  )

  // Derive active category
  const effectiveCategoryId = activeCategoryId || (categories && categories.length > 0 ? categories[0].id : null)

  // Filter items by category and search
  const filteredItems = useMemo(() => {
    if (!menuItems) return []
    let items = menuItems
    if (effectiveCategoryId) {
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
        return { id: itemId, name: item.nameEn, nameZh: item.nameZh, qty, price: item.price, total: item.price * qty }
      })
      .filter(Boolean) as { id: string; name: string; nameZh: string | null; qty: number; price: number; total: number }[]
  }, [quantities, menuItems])

  const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0)
  const totalItems = orderItems.reduce((sum, item) => sum + item.qty, 0)

  const updateQty = (itemId: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] || 0) + delta)
    }))
  }

  const removeItem = (itemId: string) => {
    setQuantities(prev => ({ ...prev, [itemId]: 0 }))
  }

  // Format reservation info
  const resDate = reservation
    ? new Date(reservation.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'Sat, Mar 15'
  const resYurt = reservation?.yurt?.name || 'Golden Meadow'
  const resGuests = reservation?.guestCount?.toString() || '12'

  return (
    <div className="flex flex-col min-h-0 flex-1 bg-cream">
      {/* Info Bar */}
      <div className="h-14 bg-white border-b border-beige flex items-center justify-between px-6 md:px-20 shrink-0">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-amber" />
          <span className="text-sm font-medium text-brown">
            {t('infoBar', { date: resDate, yurt: resYurt, guests: resGuests })}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-[#FEF3CD] rounded-lg px-3 py-1.5">
          <Timer size={14} className="text-amber" />
          <span className="text-xs font-semibold text-amber">{t('orderBy', { date: 'Mar 12' })}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Panel - Menu Browsing */}
        <div className="flex-1 flex flex-col gap-4 py-6 pl-6 md:pl-20 pr-6 md:pr-10 bg-cream overflow-y-auto">
          {/* Category Tabs */}
          <div className="flex gap-2 flex-wrap">
            {categories?.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`px-[18px] py-2 rounded-full text-[13px] font-semibold cursor-pointer border-none transition-colors ${
                  effectiveCategoryId === cat.id
                    ? 'bg-amber text-white'
                    : 'bg-white text-brown'
                }`}
                style={effectiveCategoryId !== cat.id ? { border: '1px solid #E8DFD0' } : {}}
              >
                {cat.nameEn}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-2.5 h-11 px-3.5 bg-[#F9F6F1] rounded-xl border border-beige">
            <Search size={18} className="text-[#8E8E93]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="flex-1 bg-transparent outline-none text-sm text-brown placeholder:text-[#BFBFBF]"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-[#8E8E93] bg-transparent border-none cursor-pointer">
                <X size={16} />
              </button>
            )}
          </div>

          {/* Dish List */}
          <div className="flex flex-col gap-2">
            {!menuItems ? (
              <div className="py-8 text-center text-gray-text text-sm">Loading menu...</div>
            ) : filteredItems.length === 0 ? (
              <div className="py-8 text-center text-gray-text text-sm">No items found</div>
            ) : (
              filteredItems.map((item) => {
                const qty = quantities[item.id] || 0
                const isSelected = qty > 0
                const firstTag = item.tags[0] || ''
                const tagStyle = getTagStyle(firstTag)

                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3.5 p-3 rounded-xl transition-colors ${
                      isSelected ? 'bg-[#FEF8EE]' : 'bg-white border border-beige'
                    }`}
                  >
                    {/* Image */}
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.nameEn}
                        className="w-14 h-14 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-[#F9F6F1] flex items-center justify-center shrink-0">
                        <ShoppingCart size={20} className="text-beige" />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-semibold text-brown truncate">{item.nameEn}</span>
                        {item.nameZh && (
                          <span className="text-[13px] text-[#8E8E93] shrink-0">{item.nameZh}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold text-amber">${item.price}</span>
                        {firstTag && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ color: tagStyle.color, backgroundColor: tagStyle.bg }}
                          >
                            {firstTag}
                          </span>
                        )}
                        {item.advanceDaysRequired > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#FFE0E0] text-[#C0392B]">
                            {item.advanceDaysRequired}d advance
                          </span>
                        )}
                      </div>
                      {item.descriptionEn && (
                        <p className="text-[11px] text-[#8E8E93] line-clamp-1">{item.descriptionEn}</p>
                      )}
                    </div>

                    {/* Quantity Control */}
                    <div className="flex items-center shrink-0">
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer border-none ${
                          qty > 0 ? 'bg-[#F5ECD8]' : 'bg-[#F0F0F0]'
                        }`}
                      >
                        <Minus size={16} className={qty > 0 ? 'text-amber' : 'text-[#C0C0C0]'} />
                      </button>
                      <span className={`w-10 text-center text-lg font-bold ${qty > 0 ? 'text-brown' : 'text-[#C0C0C0]'}`}>
                        {qty}
                      </span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        className="w-8 h-8 rounded-lg bg-amber flex items-center justify-center cursor-pointer border-none"
                      >
                        <Plus size={16} className="text-white" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Panel - Order Summary */}
        <div className="w-[420px] py-6 pr-6 md:pr-20 pl-6 md:pl-10 overflow-y-auto shrink-0">
          <div className="bg-white rounded-2xl p-6 shadow-[0_4px_16px_rgba(0,0,0,0.06)] flex flex-col gap-5 sticky top-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-playfair text-xl font-bold text-brown">{t('yourOrder')}</h3>
              <div className="w-7 h-7 rounded-full bg-amber text-white text-[13px] font-bold flex items-center justify-center">
                {totalItems}
              </div>
            </div>

            {/* Empty order state */}
            {orderItems.length === 0 && (
              <div className="py-8 text-center">
                <ShoppingCart size={32} className="text-beige mx-auto mb-3" />
                <p className="text-sm text-[#8E8E93]">Add items from the menu to start your order</p>
              </div>
            )}

            {/* Items List */}
            {orderItems.length > 0 && (
              <div className="flex flex-col">
                {orderItems.map((item, i) => (
                  <div key={item.id}>
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-sm text-brown truncate">{item.name}</span>
                        <span className="text-sm font-bold text-amber shrink-0">x{item.qty}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold text-brown">${item.total}</span>
                        <X
                          size={14}
                          className="text-[#BFBFBF] cursor-pointer hover:text-[#DC3545]"
                          onClick={() => removeItem(item.id)}
                        />
                      </div>
                    </div>
                    {i < orderItems.length - 1 && <div className="h-px bg-beige" />}
                  </div>
                ))}
              </div>
            )}

            {/* Totals */}
            <div className="border-t border-beige pt-4 flex flex-col gap-3">
              <div className="flex justify-between">
                <span className="text-sm text-[#8E8E93]">{t('subtotal')}</span>
                <span className="text-sm text-brown">${subtotal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-brown">{t('estimatedTotal')}</span>
                <span className="font-playfair text-2xl font-bold text-amber">${subtotal}</span>
              </div>
              <span className="text-xs text-[#5B8C3E]">{t('depositPaid')}</span>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-brown">{t('kitchenNotes')}</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('kitchenNotesPlaceholder')}
                className="h-20 px-3.5 py-3.5 bg-[#F9F6F1] rounded-[10px] border border-beige text-[13px] resize-none outline-none placeholder:text-[#BFBFBF] text-brown"
              />
            </div>

            <p className="text-xs text-[#8E8E93] text-center">
              {t('paymentNote')}
            </p>

            {/* Submit */}
            <button
              disabled={orderItems.length === 0}
              className="h-[52px] rounded-2xl bg-gradient-to-r from-[#8B6914] to-[#A67C2E] text-white text-[15px] font-semibold border-none cursor-pointer shadow-[0_4px_16px_rgba(139,105,20,0.2)] w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('submitOrder')}
            </button>

            {/* Save Draft */}
            {orderItems.length > 0 && (
              <button className="h-10 rounded-xl border border-beige text-sm font-medium text-brown bg-white cursor-pointer hover:bg-beige/30 w-full">
                Save Draft
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
