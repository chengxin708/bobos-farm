"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import Link from 'next/link'
import Image from 'next/image'
import { UtensilsCrossed, Info, Clock, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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

const TAG_LABELS: Record<string, string> = {
  'signature':     'Signature',
  'advance-order': 'Pre-order',
  'popular':       'Popular',
  'vegetarian':    'Vegetarian',
  'gluten-free':   'GF',
  'non-alcoholic': 'N/A',
}

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------

function TabsSkeleton() {
  return (
    <div className="flex gap-2 px-4 py-3 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-9 w-20 rounded-full skeleton-pulse shrink-0" />
      ))}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3 py-4 px-4 border-b border-[#F2EDE6]">
          <div className="w-[60px] h-[60px] rounded-xl skeleton-pulse shrink-0" />
          <div className="flex flex-col gap-2 flex-1">
            <div className="h-4 w-3/4 skeleton-pulse" />
            <div className="h-3 w-1/2 skeleton-pulse" />
            <div className="h-3 w-full skeleton-pulse" />
            <div className="h-4 w-12 skeleton-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Menu Item Row
// ---------------------------------------------------------------------------

function MenuItemRow({
  item,
  isExpanded,
  onToggle,
  displayName,
  secondaryName,
  description,
  t,
  isAuthenticated,
}: {
  item: MenuItem
  isExpanded: boolean
  onToggle: () => void
  displayName: string
  secondaryName: string
  description: string
  t: ReturnType<typeof useTranslations<'menu'>>
  isAuthenticated: boolean
}) {
  return (
    <div className="border-b border-[#F2EDE6]">
      {/* Collapsed row */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex gap-4 py-4 md:py-5 px-4 md:px-6 text-left bg-transparent border-none cursor-pointer hover:bg-[#F2EDE6]/50 transition-colors"
      >
        {/* Image */}
        <div className="w-[60px] h-[60px] md:w-[72px] md:h-[72px] rounded-xl overflow-hidden shrink-0 bg-[#F2EDE6] flex items-center justify-center">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={displayName}
              width={72}
              height={72}
              className="w-full h-full object-cover"
            />
          ) : (
            <UtensilsCrossed size={22} color="#8C8478" strokeWidth={1.5} />
          )}
        </div>

        {/* Text */}
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <span className="font-serif text-[16px] text-[#1A1208] leading-snug truncate">
            {displayName}
          </span>
          {secondaryName && (
            <span className="font-sans text-[13px] text-[#8C8478] leading-snug truncate">
              {secondaryName}
            </span>
          )}
          {description && (
            <span className="font-sans text-[14px] text-[#8C8478] leading-snug line-clamp-2 mt-0.5">
              {description}
            </span>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {isAuthenticated ? (
              <span className="text-[#C47D52] font-medium text-[14px]">
                ${Math.round(item.price)}
              </span>
            ) : (
              <Link
                href="/login?callbackUrl=/menu"
                className="text-[#6B7F5E] text-[13px] no-underline hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Sign in to reveal price
              </Link>
            )}
            {item.tags && item.tags.length > 0 && item.tags.map((tag) => {
              const label = TAG_LABELS[tag]
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
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 md:px-6 pb-4 md:pb-5 flex flex-col gap-3">
              {/* Close button */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onToggle}
                  className="w-7 h-7 rounded-full bg-[#1A1208]/5 flex items-center justify-center border-none cursor-pointer"
                >
                  <X size={14} color="#8C8478" />
                </button>
              </div>

              {/* Large image */}
              {item.imageUrl && (
                <div className="w-full aspect-[16/10] rounded-2xl overflow-hidden bg-[#F2EDE6]">
                  <Image
                    src={item.imageUrl}
                    alt={displayName}
                    width={600}
                    height={375}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Full description */}
              {description && (
                <p className="font-sans text-[14px] text-[#8C8478] leading-relaxed">
                  {description}
                </p>
              )}

              {/* All tags */}
              {item.tags && item.tags.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {item.tags.map((tag) => {
                    const label = TAG_LABELS[tag]
                    if (!label) return null
                    return (
                      <span
                        key={tag}
                        className="rounded-full px-2.5 py-1 text-[12px] bg-[#E8ECE4] text-[#6B7F5E]"
                      >
                        {label}
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Pre-order notice */}
              {item.advanceDaysRequired > 0 && (
                <div className="flex items-center gap-2 bg-[#E8ECE4] rounded-full px-3 py-1.5 w-fit">
                  <Clock size={14} color="#6B7F5E" />
                  <span className="text-[12px] text-[#6B7F5E] font-medium">
                    {item.advanceDaysRequired >= 3
                      ? t('advanceNotice3')
                      : t('advanceNotice2')}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MenuPage() {
  const t = useTranslations('menu')
  const locale = useLocale()
  const { data: session } = useSession()
  const isAuthenticated = !!session?.user

  // Fetch categories
  const { data: categories, isLoading: catLoading } = useSWR<MenuCategory[]>(
    '/api/menu/categories',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  // Fetch ALL active items at once (no categoryId filter)
  const { data: allItems, isLoading: itemsLoading } = useSWR<MenuItem[]>(
    '/api/menu/items?activeOnly=true',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  )

  // Active pill state (for highlighting)
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  // Expanded item state
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  // Section refs for scroll + IntersectionObserver
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const navRef = useRef<HTMLDivElement>(null)
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  // Prevent observer from fighting with programmatic scroll
  const isScrollingRef = useRef(false)

  // Group items by category, maintaining category sort order
  const groupedItems = useMemo(() => {
    if (!allItems || !categories) return []
    const map = new Map<string, MenuItem[]>()
    for (const item of allItems) {
      const list = map.get(item.categoryId) || []
      list.push(item)
      map.set(item.categoryId, list)
    }
    // Return categories that have items, in sortOrder
    return categories
      .filter(cat => map.has(cat.id))
      .map(cat => ({ category: cat, items: map.get(cat.id)! }))
  }, [allItems, categories])

  // Resolve activeTabId — default to first category
  const resolvedTabId = activeTabId ?? (groupedItems[0]?.category.id ?? null)

  // IntersectionObserver: detect which section is visible
  useEffect(() => {
    if (groupedItems.length === 0) return

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
      { rootMargin: '-100px 0px -60% 0px', threshold: 0 }
    )

    const refs = sectionRefs.current
    for (const el of Object.values(refs)) {
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [groupedItems])

  // Scroll active pill into view in the nav bar
  useEffect(() => {
    if (!resolvedTabId || !pillRefs.current[resolvedTabId] || !navRef.current) return
    const pill = pillRefs.current[resolvedTabId]!
    const nav = navRef.current
    const pillLeft = pill.offsetLeft
    const pillWidth = pill.offsetWidth
    const navWidth = nav.offsetWidth
    const scrollTarget = pillLeft - navWidth / 2 + pillWidth / 2
    nav.scrollTo({ left: scrollTarget, behavior: 'smooth' })
  }, [resolvedTabId])

  // Scroll to a category section
  const scrollToCategory = useCallback((categoryId: string) => {
    setActiveTabId(categoryId)
    const el = sectionRefs.current[categoryId]
    if (!el) return
    isScrollingRef.current = true
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // Re-enable observer after scroll settles
    setTimeout(() => { isScrollingRef.current = false }, 800)
  }, [])

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

  const toggleExpanded = (id: string) => {
    setExpandedItemId(prev => prev === id ? null : id)
  }

  return (
    <div className="flex flex-col max-w-[900px] mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col items-center pt-8 pb-5 px-6 md:px-12">
        <h1 className="font-serif text-2xl md:text-3xl text-[#1A1208] text-center">{t('title')}</h1>
        <div className="w-10 h-[2px] bg-[#6B7F5E] mt-3" />
      </div>

      {/* Category Nav — sticky */}
      {catLoading ? (
        <TabsSkeleton />
      ) : !categories || categories.length === 0 ? (
        <div className="flex items-center justify-center py-20 px-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <UtensilsCrossed size={32} color="#8C8478" strokeWidth={1.5} />
            <h3 className="font-serif text-lg text-[#1A1208]">Menu Coming Soon</h3>
            <p className="text-sm text-[#8C8478] max-w-[280px]">
              Our menu is being prepared. Please check back soon to explore our farm-to-table dishes.
            </p>
          </div>
        </div>
      ) : (
        <div className="sticky top-0 z-10 bg-[#F8F7F4]/95 backdrop-blur-sm py-3 px-4 md:px-8 border-b border-[#F2EDE6]">
          <div ref={navRef} className="flex gap-2 overflow-x-auto hide-scrollbar md:justify-center">
            {groupedItems.map(({ category: cat }) => {
              const isActive = cat.id === resolvedTabId
              const emoji = CATEGORY_EMOJIS[cat.nameEn] ?? ''
              return (
                <button
                  key={cat.id}
                  ref={(el) => { pillRefs.current[cat.id] = el }}
                  onClick={() => scrollToCategory(cat.id)}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm whitespace-nowrap shrink-0 cursor-pointer border transition-colors duration-200 ${
                    isActive
                      ? 'bg-[#6B7F5E] text-white border-[#6B7F5E]'
                      : 'bg-transparent border-[#6B7F5E]/20 text-[#1A1208]'
                  }`}
                >
                  <span>{emoji}</span>
                  <span>{categoryLabel(cat)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Waterfall Content */}
      <div className="flex flex-col pb-4 md:px-4">
        {itemsLoading || catLoading ? (
          <ListSkeleton />
        ) : groupedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <UtensilsCrossed size={28} color="#8C8478" strokeWidth={1.5} />
            <p className="text-[#8C8478] text-sm">No items available</p>
          </div>
        ) : (
          groupedItems.map(({ category: cat, items }) => {
            const emoji = CATEGORY_EMOJIS[cat.nameEn] ?? ''
            return (
              <div
                key={cat.id}
                ref={(el) => { sectionRefs.current[cat.id] = el }}
                data-category-id={cat.id}
                className="scroll-mt-14"
              >
                {/* Section header */}
                <div className="flex items-center gap-2.5 px-4 md:px-6 pt-8 pb-3">
                  <span className="text-lg">{emoji}</span>
                  <h2 className="font-serif text-lg md:text-xl text-[#1A1208]">{categoryLabel(cat)}</h2>
                  <div className="flex-1 h-px bg-[#E8E2D9] ml-2" />
                </div>

                {/* Whole Lamb banner */}
                {cat.nameEn === 'Whole Lamb' && (
                  <div className="flex items-center gap-2.5 bg-[#E8ECE4] rounded-xl mx-4 md:mx-6 mb-2 px-4 py-3">
                    <Info size={18} color="#6B7F5E" strokeWidth={1.8} className="shrink-0" />
                    <p className="text-[13px] text-[#6B7F5E] leading-relaxed">
                      {t('lambNotice')}
                    </p>
                  </div>
                )}

                {/* Items */}
                <div className="flex flex-col">
                  {items.map((item) => (
                    <MenuItemRow
                      key={item.id}
                      item={item}
                      isExpanded={expandedItemId === item.id}
                      onToggle={() => toggleExpanded(item.id)}
                      displayName={itemDisplayName(item)}
                      secondaryName={itemSecondaryName(item)}
                      description={itemDescription(item)}
                      t={t}
                      isAuthenticated={isAuthenticated}
                    />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
