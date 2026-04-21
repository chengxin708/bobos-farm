"use client"

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'

export type GuestRangeValue = { min: number; max: number }

interface Props {
  value: GuestRangeValue | null
  onChange: (val: GuestRangeValue | null) => void
  /** Preset values shown in the grid. Defaults cover the farm's 10–71 capacity at 5-guest steps. */
  presets?: number[]
  /** Counts above this trigger a soft "will become an inquiry" hint below the grid. */
  softThreshold?: number
}

const DEFAULT_PRESETS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 71]

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
        <span className="text-sm font-medium text-[#6B6157]">{t('title')}</span>
        {value && (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-[#6B6157] hover:text-[#2C2416] transition-colors border-none bg-transparent cursor-pointer"
            aria-label={t('reset')}
          >
            <X size={12} />
            {t('reset')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {presets.map((n) => {
          const state = presetState(n)
          const buttonClass =
            state === 'anchor'
              ? 'bg-[#6B7F5E] text-white shadow-sm'
              : state === 'inside'
                ? 'bg-[#6B7F5E]/20 text-[#3D4A35]'
                : state === 'outside'
                  ? 'bg-transparent text-[#8C8478]/50'
                  : 'bg-transparent text-[#1A1208] hover:bg-[#E8ECE4]'
          return (
            <button
              key={n}
              type="button"
              onClick={() => handleClick(n)}
              aria-pressed={state === 'anchor' || state === 'inside'}
              aria-label={t('presetAria', { count: n })}
              className={`h-10 rounded-full border-none transition-colors text-sm font-semibold cursor-pointer ${buttonClass}`}
            >
              {n}
            </button>
          )
        })}
      </div>

      <p className="mt-3 text-center text-sm font-medium text-[#3D4A35] min-h-[20px]">
        {label}
      </p>

      {mode === 'empty' && (
        <p className="mt-1 text-center text-xs text-[#8C8478]">{t('helpText')}</p>
      )}
      {mode === 'single' && (
        <p className="mt-1 text-center text-xs text-[#8C8478]">{t('helpSingle')}</p>
      )}
      {overThreshold && (
        <p className="mt-2 text-center text-xs text-[#8B6914] font-medium">
          {t('overThresholdHint', { threshold: softThreshold! })}
        </p>
      )}
    </div>
  )
}
