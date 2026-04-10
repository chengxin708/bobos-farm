"use client"

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Tent, Users, CalendarX } from 'lucide-react'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import { useBooking } from '@/contexts/BookingContext'

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

interface Yurt {
  id: string
  name: string
  description: string | null
  capacity: number
  status: string
  imageUrl: string | null
  sortOrder: number
}

interface AvailabilityRecord {
  id: string
  yurtId: string
  date: string
  isOpen: boolean
  note: string | null
}

const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1618767689160-da3fb810aad7?w=500&q=80',
  'https://images.unsplash.com/photo-1499696010180-025ef6e1a8f9?w=500&q=80',
  'https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=500&q=80',
]

export default function BookingYurtPage() {
  const t = useTranslations('booking.yurt')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { selectedDate, selectedYurtId, setSelectedYurt, hydrated } = useBooking()

  // Redirect back if no date selected (only after hydration to prevent false redirect on refresh)
  useEffect(() => {
    if (hydrated && !selectedDate) {
      router.replace('/booking/date')
    }
  }, [hydrated, selectedDate, router])

  // Fetch all yurts
  const { data: yurts, isLoading: loadingYurts } = useSWR<Yurt[]>(
    '/api/yurts',
    fetcher,
    { revalidateOnFocus: false }
  )

  // Fetch availability for the selected date
  const { data: availability } = useSWR<AvailabilityRecord[]>(
    selectedDate
      ? `/api/availability?startDate=${selectedDate}&endDate=${selectedDate}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  // Build set of closed yurt IDs for this date (memoized)
  const closedYurtIds = useMemo(() => {
    const set = new Set<string>()
    if (Array.isArray(availability)) {
      for (const rec of availability) {
        if (!rec.isOpen) set.add(rec.yurtId)
      }
    }
    return set
  }, [availability])

  const activeYurts = Array.isArray(yurts) ? yurts.filter((y) => y.status === 'ACTIVE') : []
  const availableYurts = activeYurts.filter((y) => !closedYurtIds.has(y.id))

  // Format the selected date for display
  const formattedDate = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : ''

  function isYurtAvailable(yurt: Yurt): boolean {
    return !closedYurtIds.has(yurt.id)
  }

  function handleYurtClick(yurt: Yurt) {
    if (!isYurtAvailable(yurt)) return
    if (selectedYurtId === yurt.id) {
      setSelectedYurt(null)
    } else {
      setSelectedYurt({
        id: yurt.id,
        name: yurt.name,
        capacity: yurt.capacity,
        imageUrl: yurt.imageUrl,
      })
    }
  }

  // Show spinner while hydrating from sessionStorage
  if (!hydrated) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="w-10 h-10 rounded-full border-[3px] border-beige border-t-amber animate-spin" />
      </div>
    )
  }

  if (!selectedDate) return null

  return (
    <>
      {/* Content */}
      <div className="flex-1 flex flex-col items-center py-6 px-4 sm:px-10 lg:px-20 gap-8 overflow-y-auto">
        <div className="text-center">
          <h2 className="font-playfair text-[28px] font-bold text-brown">{t('title')}</h2>
          <p className="text-base text-brown/53 mt-2">{formattedDate}</p>
        </div>

        {/* Yurt Cards */}
        {loadingYurts ? (
          <div className="flex gap-6 w-full max-w-[1100px]">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 bg-white rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.03)]">
                <div className="h-[200px] bg-beige/30 animate-pulse" />
                <div className="p-5 flex flex-col gap-3">
                  <div className="h-5 w-32 bg-beige/30 rounded animate-pulse" />
                  <div className="h-4 w-20 bg-beige/30 rounded animate-pulse" />
                  <div className="h-12 w-full bg-beige/30 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : activeYurts.length === 0 ? (
          /* Empty state: no active yurts configured */
          <div className="flex flex-col items-center gap-4 py-12 max-w-md text-center">
            <div className="w-20 h-20 rounded-full bg-[#F9F6F1] flex items-center justify-center">
              <Tent size={36} className="text-beige" />
            </div>
            <h3 className="font-playfair text-xl font-bold text-brown">No Yurts Available</h3>
            <p className="text-sm text-[#8E8E93]">
              There are no yurts configured yet. Please check back later or contact us for assistance.
            </p>
            <button
              onClick={() => router.push('/booking/date')}
              className="mt-2 px-6 py-2.5 rounded-xl border border-beige text-brown text-sm font-medium cursor-pointer bg-white"
            >
              {tCommon('back')}
            </button>
          </div>
        ) : availableYurts.length === 0 ? (
          /* Empty state: all yurts booked/closed for this date */
          <div className="flex flex-col items-center gap-4 py-12 max-w-md text-center">
            <div className="w-20 h-20 rounded-full bg-[#FEF3CD] flex items-center justify-center">
              <CalendarX size={36} className="text-[#F4A623]" />
            </div>
            <h3 className="font-playfair text-xl font-bold text-brown">Fully Booked</h3>
            <p className="text-sm text-[#8E8E93]">
              All yurts are booked for {formattedDate}. Please go back and select a different date.
            </p>
            <button
              onClick={() => router.push('/booking/date')}
              className="mt-2 px-6 py-2.5 rounded-xl bg-amber text-white text-sm font-semibold cursor-pointer border-none"
            >
              Choose Another Date
            </button>
          </div>
        ) : (
          <div className="flex gap-6 w-full max-w-[1100px]">
            {activeYurts.map((yurt, i) => {
              const available = isYurtAvailable(yurt)
              const selected = selectedYurtId === yurt.id
              const imgSrc = yurt.imageUrl || PLACEHOLDER_IMAGES[i % PLACEHOLDER_IMAGES.length]

              return (
                <button
                  key={yurt.id}
                  type="button"
                  onClick={() => handleYurtClick(yurt)}
                  disabled={!available}
                  aria-label={`${yurt.name} - ${available ? t('status.available') : t('status.booked')} - Up to ${yurt.capacity} guests`}
                  aria-pressed={selected}
                  className={`flex-1 bg-white rounded-2xl overflow-hidden text-left transition-all relative border-none p-0 ${
                    selected
                      ? 'ring-[3px] ring-amber shadow-[0_4px_24px_rgba(0,0,0,0.06)]'
                      : 'shadow-[0_2px_16px_rgba(0,0,0,0.03)]'
                  } ${!available ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {/* Image */}
                  <div className="h-[200px] overflow-hidden relative">
                    <img src={imgSrc} alt={yurt.name} className="w-full h-full object-cover" />
                    {/* Badge */}
                    <div
                      className={`absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        available ? 'bg-green text-white' : 'bg-gray-400 text-white'
                      }`}
                    >
                      <Tent size={12} /> {available ? t('status.available') : t('status.booked')}
                    </div>
                    {/* Selected check */}
                    {selected && (
                      <div className="absolute bottom-3 right-3 w-8 h-8 bg-amber rounded-full flex items-center justify-center">
                        <Check size={16} className="text-white" />
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-5 flex flex-col gap-2">
                    <h3 className="font-playfair text-lg font-bold text-brown">{yurt.name}</h3>
                    <div className="flex items-center gap-1.5 text-[13px] text-brown/60">
                      <Users size={14} /> Up to {yurt.capacity} guests
                    </div>
                    {yurt.description && (
                      <p className="text-[13px] text-brown/53 leading-relaxed">{yurt.description}</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="h-16 shrink-0 bg-white border-t border-beige flex items-center justify-between px-4 sm:px-10 lg:px-20">
        <button
          onClick={() => router.push('/booking/date')}
          className="flex items-center gap-2 px-4 py-2.5 text-[15px] font-medium text-brown border-none bg-transparent cursor-pointer"
        >
          <ArrowLeft size={18} /> {tCommon('back')}
        </button>
        <div className="flex items-center gap-3">
          {!selectedYurtId && activeYurts.length > 0 && availableYurts.length > 0 && (
            <span className="text-sm text-[#8E8E93]">Select a yurt to continue</span>
          )}
          <button
            onClick={() => selectedYurtId && router.push('/booking/details')}
            disabled={!selectedYurtId}
            aria-label={!selectedYurtId ? 'Select a yurt to continue' : 'Continue to details'}
            className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl text-base font-semibold border-none transition-colors ${
              selectedYurtId
                ? 'bg-gradient-to-r from-amber to-[#A67C2E] text-white cursor-pointer shadow-[0_4px_16px_rgba(139,105,20,0.2)]'
                : 'bg-[#BFBFBF] text-white/70 cursor-not-allowed'
            }`}
          >
            {tCommon('next')} <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </>
  )
}
