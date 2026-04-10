"use client"

import { useState, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import Link from 'next/link'
import { Lock } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MenuCategory {
  id: string
  nameEn: string
  nameZh: string | null
  sortOrder: number
  _count: { items: number }
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fetcher = (url: string) => fetch(url).then(r => {
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

const CATEGORY_I18N_KEY: Record<string, string> = {
  'Whole Lamb': 'categories.wholeLamb',
  'Signature Dishes': 'categories.signatureDishes',
  'Iron Pot Stews': 'categories.ironPotStews',
  'Cold Dishes': 'categories.coldDishes',
  'Staples': 'categories.staples',
  'Beverages': 'categories.beverages',
}

interface TagStyle {
  label: string
  bg: string
  text: string
}

const TAG_STYLES: Record<string, TagStyle> = {
  'signature':     { label: '\u{1F525} Signature',  bg: '#F5ECD8', text: '#8B6914' },
  'advance-order': { label: '\u23F0 Pre-order',     bg: '#FEF3CD', text: '#8B6914' },
  'popular':       { label: '\u{1F525} Popular',    bg: '#F5ECD8', text: '#8B6914' },
  'vegetarian':    { label: '\u{1F33F} Vegetarian', bg: '#EAF2E3', text: '#5B8C3E' },
  'gluten-free':   { label: '\u2713 GF',            bg: '#EAF2E3', text: '#5B8C3E' },
  'non-alcoholic': { label: '\u{1F964} N/A',        bg: '#E8F4FD', text: '#2980B9' },
}

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------

function TabsSkeleton() {
  return (
    <div className="flex items-end px-20 bg-white shadow-sm h-[52px] gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-5 w-28 my-auto rounded bg-[#E8DFD0] animate-pulse" />
      ))}
    </div>
  )
}

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.03)]">
          <div className="h-[200px] bg-[#E8DFD0] animate-pulse" />
          <div className="p-4 flex flex-col gap-2">
            <div className="h-4 w-3/4 rounded bg-[#E8DFD0] animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-[#E8DFD0] animate-pulse" />
            <div className="h-5 w-16 rounded bg-[#E8DFD0] animate-pulse" />
            <div className="h-3 w-full rounded bg-[#E8DFD0] animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-[#E8DFD0] animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Auth overlay
// ---------------------------------------------------------------------------

function AuthOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#FFF8F0CC] backdrop-blur-sm">
      <div
        className="w-[400px] bg-white rounded-2xl flex flex-col items-center gap-6 px-9 py-10"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)' }}
      >
        {/* Lock icon */}
        <div className="w-20 h-20 rounded-full bg-[#F5ECD8] flex items-center justify-center">
          <Lock size={36} color="#8B6914" strokeWidth={1.8} />
        </div>

        {/* Title */}
        <h2 className="font-playfair text-2xl font-bold text-brown text-center">
          Sign in to view our menu
        </h2>

        {/* Description */}
        <p className="text-sm text-brown/53 text-center leading-relaxed whitespace-pre-line">
          {"Create an account or sign in to explore\nour authentic dishes and place orders"}
        </p>

        {/* Sign In button */}
        <Link
          href="/login"
          className="w-full h-[50px] rounded-2xl bg-gradient-to-r from-amber to-[#A67C2E] text-white text-base font-semibold flex items-center justify-center no-underline"
        >
          Sign In
        </Link>

        {/* Create Account button */}
        <Link
          href="/register"
          className="w-full h-[50px] rounded-2xl bg-white border-[1.5px] border-[#E8DFD0] text-brown text-base font-semibold flex items-center justify-center no-underline"
        >
          Create Account
        </Link>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MenuPage() {
  const t = useTranslations('menu')
  const locale = useLocale()
  const { data: session, status: authStatus } = useSession()
  const isAuthenticated = !!session?.user

  // Fetch categories
  const { data: categories, isLoading: catLoading } = useSWR<MenuCategory[]>(
    '/api/menu/categories',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  // Active tab state — keyed to category id
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  // Resolve the active category id: default to first category once loaded
  const resolvedTabId = activeTabId ?? (categories?.[0]?.id ?? null)

  // Fetch items for the active category
  const { data: items, isLoading: itemsLoading } = useSWR<MenuItem[]>(
    resolvedTabId
      ? `/api/menu/items?categoryId=${resolvedTabId}&activeOnly=true`
      : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  )

  // Figure out the active category nameEn for special logic (e.g. Whole Lamb banner)
  const activeCategoryName = useMemo(() => {
    if (!categories || !resolvedTabId) return ''
    return categories.find(c => c.id === resolvedTabId)?.nameEn ?? ''
  }, [categories, resolvedTabId])

  // Build display name for locale
  const categoryDisplayName = (cat: MenuCategory) =>
    locale === 'zh' && cat.nameZh ? cat.nameZh : cat.nameEn

  const itemDisplayName = (item: MenuItem) =>
    locale === 'zh' && item.nameZh ? item.nameZh : item.nameEn

  const itemSecondaryName = (item: MenuItem) =>
    locale === 'zh' ? item.nameEn : (item.nameZh ?? '')

  const itemDescription = (item: MenuItem) =>
    locale === 'zh' && item.descriptionZh
      ? item.descriptionZh
      : (item.descriptionEn ?? '')

  // i18n-aware category label with fallback
  const categoryLabel = (cat: MenuCategory) => {
    const key = CATEGORY_I18N_KEY[cat.nameEn]
    if (key) {
      try {
        return t(key as Parameters<typeof t>[0])
      } catch {
        // fallback
      }
    }
    return categoryDisplayName(cat)
  }

  return (
    <div className="flex flex-col min-h-screen bg-cream">
      {/* Auth overlay for unauthenticated users */}
      {authStatus !== 'loading' && !isAuthenticated && <AuthOverlay />}

      {/* Blurred background content when not authenticated */}
      <div className={!isAuthenticated && authStatus !== 'loading' ? 'opacity-20 pointer-events-none' : ''}>

        {/* Header */}
        <div className="flex flex-col items-center gap-3 pt-12 pb-8 px-20">
          <h1 className="font-playfair text-[40px] font-bold text-brown text-center">{t('title')}</h1>
          <div className="w-20 h-[3px] rounded bg-gradient-to-r from-amber to-terracotta" />
          <p className="text-base text-brown/53 text-center">{t('subtitle')}</p>
        </div>

        {/* Category Tabs */}
        {catLoading ? (
          <TabsSkeleton />
        ) : (
          <div className="flex items-end px-20 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.03)] h-[52px]">
            {(categories ?? []).map((cat) => {
              const isActive = cat.id === resolvedTabId
              const emoji = CATEGORY_EMOJIS[cat.nameEn] ?? ''
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveTabId(cat.id)}
                  className={`flex items-center gap-2 px-6 py-3.5 text-sm cursor-pointer bg-transparent border-none ${
                    isActive
                      ? 'font-semibold text-amber border-b-[3px] border-amber'
                      : 'text-brown/47'
                  }`}
                >
                  <span>{emoji}</span>
                  <span>{categoryLabel(cat)}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Content */}
        <div className="flex flex-col gap-7 px-20 py-6 pb-16">
          {/* Info Banner for Whole Lamb */}
          {activeCategoryName === 'Whole Lamb' && (
            <div className="flex items-center gap-3 bg-[#FEF3CD] rounded-xl px-5 py-4 border-l-4 border-amber">
              <span className="text-lg">{'\u{1F411}'}</span>
              <p className="text-[13px] text-[#7A5D10] leading-relaxed">
                {t('lambNotice')}
              </p>
            </div>
          )}

          {/* Card Grid */}
          {itemsLoading || catLoading ? (
            <CardsSkeleton />
          ) : !items || items.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-brown/47 text-base">No items in this category</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-6">
              {items.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.03)]">
                  {/* Image */}
                  {item.imageUrl && (
                    <div className="h-[200px] overflow-hidden">
                      <img src={item.imageUrl} alt={itemDisplayName(item)} className="w-full h-full object-cover" />
                    </div>
                  )}

                  {/* Body */}
                  <div className="p-4 flex flex-col gap-2">
                    <div className="text-base font-bold text-brown">{itemDisplayName(item)}</div>
                    {itemSecondaryName(item) && (
                      <div className="text-sm text-brown/53">{itemSecondaryName(item)}</div>
                    )}
                    <div className="text-xl font-bold text-amber">${Math.round(item.price)}</div>
                    {itemDescription(item) && (
                      <p className="text-[13px] text-brown/47 leading-snug">{itemDescription(item)}</p>
                    )}
                    {/* Tags */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {item.tags.map((tag) => {
                          const style = TAG_STYLES[tag]
                          if (!style) return null
                          return (
                            <span
                              key={tag}
                              className="text-[10px] font-semibold px-2 py-[3px] rounded-[10px]"
                              style={{ backgroundColor: style.bg, color: style.text }}
                            >
                              {style.label}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Pre-order notice */}
                  {item.advanceDaysRequired > 0 && (
                    <div className="bg-[#FEF3CD] h-8 flex items-center justify-center">
                      <span className="text-[11px] font-medium text-[#7A5D10]">
                        {item.advanceDaysRequired >= 3
                          ? t('advanceNotice3')
                          : t('advanceNotice2')}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
