"use client"

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Check, ChevronLeft, ChevronRight, Tent, Users } from 'lucide-react'
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
        <div className="w-10 h-10 rounded-full border-[3px] border-[#E8ECE4] border-t-[#6B7F5E] animate-spin" />
      </div>
    )
  }

  if (!selectedDate) return null

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-[#F8F7F4] px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => router.push('/booking/date')}
          className="flex items-center justify-center w-10 h-10 -ml-2 rounded-full hover:bg-[#E8ECE4] transition-colors border-none bg-transparent cursor-pointer"
          aria-label={tCommon('back')}
        >
          <ChevronLeft size={22} className="text-[#1A1208]" />
        </button>
        <span className="text-sm text-[#8C8478]">Step 2 of 4</span>
      </div>

      {/* Page Title */}
      <div className="text-center mt-4 mb-6 px-4">
        <h1 className="text-2xl font-serif text-[#1A1208]">Choose Your Yurt</h1>
      </div>

      {/* Yurt Cards */}
      <div className="flex-1 px-4 pb-28">
        <div className="max-w-[560px] mx-auto flex flex-col gap-4">
          {loadingYurts ? (
            /* Loading skeletons */
            <>
              {[1, 2].map((i) => (
                <div key={i} className="rounded-2xl overflow-hidden bg-white shadow-sm">
                  <div className="aspect-[4/3] bg-[#E8ECE4]/40 animate-pulse" />
                  <div className="p-4 flex flex-col gap-3">
                    <div className="h-5 w-32 bg-[#E8ECE4]/40 rounded animate-pulse" />
                    <div className="h-4 w-24 bg-[#E8ECE4]/40 rounded animate-pulse" />
                    <div className="h-10 w-full bg-[#E8ECE4]/40 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </>
          ) : activeYurts.length === 0 ? (
            /* Empty state: no active yurts */
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-[#E8ECE4] flex items-center justify-center">
                <Tent size={28} className="text-[#8C8478]" />
              </div>
              <p className="text-sm text-[#8C8478]">
                No yurts are available at this time. Please check back later.
              </p>
            </div>
          ) : availableYurts.length === 0 ? (
            /* Empty state: all booked */
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-[#E8ECE4] flex items-center justify-center">
                <Tent size={28} className="text-[#8C8478]" />
              </div>
              <p className="text-sm text-[#8C8478]">
                All yurts are booked for this date.
              </p>
              <button
                onClick={() => router.push('/booking/date')}
                className="text-sm text-[#6B7F5E] font-medium underline underline-offset-2 border-none bg-transparent cursor-pointer"
              >
                Try another date
              </button>
            </div>
          ) : (
            /* Yurt card list */
            activeYurts.map((yurt) => {
              const available = isYurtAvailable(yurt)
              const selected = selectedYurtId === yurt.id

              return (
                <button
                  key={yurt.id}
                  type="button"
                  onClick={() => handleYurtClick(yurt)}
                  disabled={!available}
                  aria-label={`${yurt.name} - ${available ? t('status.available') : t('status.booked')} - Up to ${yurt.capacity} guests`}
                  aria-pressed={selected}
                  className={`w-full rounded-2xl overflow-hidden bg-white shadow-sm text-left transition-all relative border-none p-0 ${
                    selected ? 'ring-2 ring-[#6B7F5E]' : ''
                  } ${!available ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {/* Image */}
                  <div className="aspect-[4/3] relative overflow-hidden">
                    {yurt.imageUrl ? (
                      <Image
                        src={yurt.imageUrl}
                        alt={yurt.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 560px) 100vw, 560px"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#FFF8F0] flex items-center justify-center">
                        <Tent size={48} className="text-[#D4C9B8]" />
                      </div>
                    )}

                    {/* Available / Booked badge */}
                    <span
                      className={`absolute top-3 right-3 text-white text-xs rounded-full px-3 py-1 font-medium ${
                        available ? 'bg-[#6B7F5E]' : 'bg-[#8C8478]'
                      }`}
                    >
                      {available ? t('status.available') : t('status.booked')}
                    </span>

                    {/* Selected check overlay */}
                    {selected && (
                      <div className="absolute top-3 left-3 bg-[#6B7F5E] text-white rounded-full p-1">
                        <Check size={16} />
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-4">
                    <h3 className="font-serif text-lg text-[#1A1208]">{yurt.name}</h3>
                    <div className="flex items-center gap-1.5 text-sm text-[#8C8478] mt-1">
                      <Users size={14} />
                      <span>Up to {yurt.capacity} guests</span>
                    </div>
                    {yurt.description && (
                      <p className="text-sm text-[#8C8478] mt-2 line-clamp-2 leading-relaxed">
                        {yurt.description}
                      </p>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Bottom Fixed Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-6 bg-[#F8F7F4]">
        <div className="max-w-[560px] mx-auto">
          <button
            onClick={() => selectedYurtId && router.push('/booking/details')}
            disabled={!selectedYurtId}
            aria-label={!selectedYurtId ? 'Select a yurt to continue' : 'Continue to details'}
            className={`w-full py-3.5 rounded-full text-base font-medium border-none transition-all flex items-center justify-center gap-2 ${
              selectedYurtId
                ? 'bg-[#6B7F5E] text-white cursor-pointer shadow-[0_2px_8px_rgba(107,127,94,0.25)]'
                : 'bg-[#6B7F5E] text-white opacity-40 cursor-not-allowed'
            }`}
          >
            {tCommon('next')}
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
