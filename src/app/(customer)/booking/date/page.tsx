"use client"

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import useSWR from 'swr'
import { useBooking } from '@/contexts/BookingContext'
import { DatePickerCalendar, type DateStatus } from '@/components/customer/DatePickerCalendar'
import { LanguageToggle } from '@/components/customer/LanguageToggle'

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function BookingDatePage() {
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const { selectedDate, setSelectedDate, hydrated } = useBooking()

  const [today] = useState(() => new Date())

  const { data: settings } = useSWR<Record<string, string>>('/api/settings/public', fetcher, {
    revalidateOnFocus: false,
  })
  const minAdvanceDays = settings?.min_advance_booking_days ? Number(settings.min_advance_booking_days) : 1
  const maxAdvanceDays = settings?.max_advance_booking_days ? Number(settings.max_advance_booking_days) : 90

  const earliestBookableStr = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + minAdvanceDays)
    return toLocalDateStr(d)
  }, [today, minAdvanceDays])

  const latestBookableStr = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + maxAdvanceDays)
    return toLocalDateStr(d)
  }, [today, maxAdvanceDays])

  // Fetch slots for a wide-enough window so month-hopping stays responsive.
  // The calendar internally restricts picks to minDate..maxDate; slot fetching
  // covers the same window.
  const { data: slots, isLoading: loadingAvail } = useSWR<Record<string, { total: number; occupied: number; available: number; mode: 'OPEN' | 'PRIVATE_EVENT' | 'CLOSED' }>>(
    `/api/availability/slots?startDate=${earliestBookableStr}&endDate=${latestBookableStr}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  const dateStatusMap = useMemo<Record<string, DateStatus>>(() => {
    if (!slots || typeof slots !== 'object') return {}
    const map: Record<string, DateStatus> = {}
    for (const [dateKey, info] of Object.entries(slots)) {
      if (info.mode === 'CLOSED' || info.mode === 'PRIVATE_EVENT') {
        map[dateKey] = 'closed'
      } else if (info.available === 0) {
        map[dateKey] = 'full'
      } else if (info.available === 1) {
        map[dateKey] = 'limited'
      } else {
        map[dateKey] = 'available'
      }
    }
    return map
  }, [slots])

  const selectedDateSlot = selectedDate && slots ? slots[selectedDate] : null

  const selectedDateFormatted = useMemo(() => {
    if (!selectedDate) return null
    try {
      const d = new Date(`${selectedDate}T00:00:00`)
      return new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(d)
    } catch {
      return selectedDate
    }
  }, [selectedDate, locale])

  if (!hydrated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#6B7F5E] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 bg-[#F8F7F4] px-4 py-3 grid grid-cols-3 items-center">
        <button
          onClick={() => router.push('/')}
          className="justify-self-start flex items-center justify-center w-10 h-10 -ml-2 rounded-full hover:bg-[#E8ECE4] transition-colors border-none bg-transparent cursor-pointer"
          aria-label={tCommon('back')}
        >
          <ChevronLeft size={22} className="text-[#1A1208]" />
        </button>
        <div className="justify-self-center">
          <LanguageToggle />
        </div>
        <span className="justify-self-end text-[15px] text-[#6B6157]">Step 1 of 3</span>
      </div>

      <div className="shrink-0 text-center mt-4 mb-6 px-4">
        <h1 className="text-2xl font-serif text-[#1A1208]">Select a Date</h1>
        {locale === 'zh' && (
          <p className="text-[15px] text-[#6B6157] mt-1 font-sans">Choose your preferred date</p>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-6">
        <DatePickerCalendar
          value={selectedDate ?? null}
          onChange={setSelectedDate}
          minDate={earliestBookableStr}
          maxDate={latestBookableStr}
          dateStatus={dateStatusMap}
          allowFullDates={false}
          showLegend
          loading={loadingAvail}
          onClosedDayClick={(dateStr) => {
            router.push(`/inquiries/new?date=${dateStr}&from=closed-day`)
          }}
        />
      </div>

      <div className="shrink-0 p-4 pb-6 bg-[#F8F7F4]">
        {selectedDate && selectedDateFormatted && (
          <p className="text-center text-sm text-[#6B6157] mb-2">
            {selectedDateFormatted}
          </p>
        )}
        {selectedDate && selectedDateSlot && selectedDateSlot.available > 0 && (
          <p className="text-center text-sm text-[#6B7F5E] mb-2 font-medium">
            {selectedDateSlot.available} {selectedDateSlot.available === 1 ? 'spot' : 'spots'} available
          </p>
        )}
        <button
          onClick={() => selectedDate && router.push('/booking/details')}
          disabled={!selectedDate}
          aria-label={!selectedDate ? 'Select a date to continue' : 'Continue to details'}
          className={`w-full py-3.5 rounded-full text-base font-medium border-none transition-all flex items-center justify-center gap-2 ${
            selectedDate
              ? 'bg-[#6B7F5E] text-white cursor-pointer shadow-[0_2px_8px_rgba(107,127,94,0.25)]'
              : 'bg-[#6B7F5E] text-white opacity-40 cursor-not-allowed'
          }`}
        >
          {tCommon('next')}
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
