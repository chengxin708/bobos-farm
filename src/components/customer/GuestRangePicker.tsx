"use client"

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'

export type GuestRangeValue = { min: number; max: number }

interface Props {
  value: GuestRangeValue | null
  onChange: (val: GuestRangeValue | null) => void
  /** Preset values shown in the grid. Defaults to every integer from 5 to 71 (full farm capacity). */
  presets?: number[]
  /** Counts above this trigger a soft "will become an inquiry" hint below the grid. */
  softThreshold?: number
}

const DEFAULT_PRESETS = Array.from({ length: 71 - 5 + 1 }, (_, i) => 5 + i)

export function GuestRangePicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  softThreshold,
}: Props) {
  const t = useTranslations('guestRangePicker')

  // Treat a range with equal min/max as "single" for both visuals and copy.
  const mode: 'empty' | 'single' | 'range' = useMemo(() => {
    if (!value) return 'empty'
    if (value.min === value.max) return 'single'
    return 'range'
  }, [value])

  function handleClick(n: number) {
    if (!value) {
      onChange({ min: n, max: n })
      return
    }
    if (value.min === value.max) {
      // Second click: turn single into a range (or noop if same number).
      if (n === value.min) return
      const min = Math.min(value.min, n)
      const max = Math.max(value.min, n)
      onChange({ min, max })
      return
    }
    // Third click from a range — reset to a fresh single at the clicked value.
    onChange({ min: n, max: n })
  }

  function handleReset() {
    onChange(null)
  }

  // Which preset buttons are "in" the current selection (for highlight styling).
  function presetState(n: number): 'anchor' | 'inside' | 'outside' | 'idle' {
    if (!value) return 'idle'
    if (n === value.min || n === value.max) return 'anchor'
    if (n > value.min && n < value.max) return 'inside'
    return 'outside'
  }

  const label = useMemo(() => {
    if (!value) return t('emptyLabel')
    if (value.min === value.max) return t('singleLabel', { count: value.min })
    return t('rangeLabel', { min: value.min, max: value.max })
  }, [value, t])

  const overThreshold = softThreshold != null && value != null && value.max > softThreshold

  return (
    <div className="rounded-xl border border-[#E8ECE4] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[#1A1208]">{t('title')}</span>
        {value && (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-xs font-semibold text-[#1A1208] hover:underline transition-colors border-none bg-transparent cursor-pointer"
            aria-label={t('reset')}
          >
            <X size={12} />
            {t('reset')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-10 gap-1">
        {presets.map((n) => {
          const state = presetState(n)
          const buttonClass =
            state === 'anchor'
              ? 'bg-[#6B7F5E] text-white shadow-sm'
              : state === 'inside'
                ? 'bg-[#6B7F5E]/25 text-[#1A1208]'
                : 'bg-transparent text-[#1A1208] hover:bg-[#E8ECE4]'
          return (
            <button
              key={n}
              type="button"
              onClick={() => handleClick(n)}
              aria-pressed={state === 'anchor' || state === 'inside'}
              aria-label={t('presetAria', { count: n })}
              className={`h-9 rounded-full border-none transition-colors text-[13px] font-semibold cursor-pointer ${buttonClass}`}
            >
              {n}
            </button>
          )
        })}
      </div>

      <p className="mt-3 text-center text-base font-semibold text-[#1A1208] min-h-[22px]">
        {label}
      </p>

      {mode === 'empty' && (
        <p className="mt-1 text-center text-xs text-[#1A1208]">{t('helpText')}</p>
      )}
      {mode === 'single' && (
        <p className="mt-1 text-center text-xs text-[#1A1208]">{t('helpSingle')}</p>
      )}
      {overThreshold && (
        <p className="mt-2 text-center text-xs text-[#8B6914] font-semibold">
          {t('overThresholdHint', { threshold: softThreshold! })}
        </p>
      )}
    </div>
  )
}
