'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import { CalendarDays } from 'lucide-react'

interface DaySummary {
  totalGuests: number
  totalCapacity: number
  reservationCount: number
  assignedCount: number
  unassignedCount: number
  hasAnomaly: boolean
}

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error('Fetch failed')
  return r.json()
})

function formatDateLocal(dateStr: string, locale: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function getDateRange(): { start: string; end: string } {
  const now = new Date()
  const start = now.toISOString().split('T')[0]
  // Show all future dates (up to 180 days) to catch all unassigned reservations
  const end = new Date(now.getTime() + 180 * 86400000).toISOString().split('T')[0]
  return { start, end }
}

export default function UpcomingAssignments() {
  const t = useTranslations('admin.dashboard')
  const router = useRouter()
  const { start, end } = getDateRange()

  const { data } = useSWR<Record<string, DaySummary>>(
    `/api/calendar-summary?startDate=${start}&endDate=${end}`,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 60000 }
  )

  // Build a list of dates from start to end
  const dates: string[] = []
  const cur = new Date(start + 'T12:00:00')
  const endDate = new Date(end + 'T12:00:00')
  while (cur <= endDate) {
    dates.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }

  // Filter to only dates with unassigned reservations
  const rows = dates
    .map(d => ({ date: d, summary: data?.[d] }))
    .filter(r => r.summary && r.summary.unassignedCount > 0)

  if (!data || rows.length === 0) return null

  return (
    <div
      className="rounded-xl p-6 flex flex-col gap-4"
      style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8ECE4', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} style={{ color: '#6B7F5E' }} />
          <span className="text-base font-bold" style={{ color: '#2C2416' }}>
            {t('upcomingAssignments')}
          </span>
        </div>
        <button
          onClick={() => router.push('/admin/calendar')}
          className="text-[13px] font-medium cursor-pointer bg-transparent border-none"
          style={{ color: '#6B7F5E' }}
        >
          {t('viewCalendar')}
        </button>
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-1">
        {rows.map(({ date, summary }) => {
          const s = summary!
          const allAssigned = s.unassignedCount === 0
          const hasAnomaly = s.hasAnomaly
          // Status: green (all assigned), yellow (some unassigned), red (anomaly)
          let statusDot: string
          let statusColor: string
          if (hasAnomaly) {
            statusDot = 'bg-[#DC3545]'
            statusColor = '#DC3545'
          } else if (allAssigned) {
            statusDot = 'bg-[#5B8C3E]'
            statusColor = '#5B8C3E'
          } else {
            statusDot = 'bg-[#D4A017]'
            statusColor = '#D4A017'
          }

          return (
            <button
              key={date}
              onClick={() => router.push(`/admin/calendar?date=${date}`)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-[#F5F2ED] cursor-pointer bg-transparent border-none w-full text-left"
              style={hasAnomaly ? { backgroundColor: '#FEF2F2' } : undefined}
            >
              {/* Status dot */}
              <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${statusDot}`} />

              {/* Date */}
              <span className="text-[13px] font-medium w-[110px] shrink-0" style={{ color: '#2C2416' }}>
                {formatDateLocal(date, 'en')}
              </span>

              {/* Stats */}
              <span className="text-[12px] flex-1" style={{ color: '#8A7E6B' }}>
                {s.reservationCount} res
              </span>

              {/* Assigned / Unassigned */}
              <span className="text-[11px] font-medium shrink-0" style={{ color: statusColor }}>
                {s.assignedCount} {t('assigned')}
                {s.unassignedCount > 0 && (
                  <span className="ml-1.5" style={{ color: '#D4A017' }}>
                    {s.unassignedCount} {t('unassigned')}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
