"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'

export type GuestRangeValue = { min: number; max: number }

interface Props {
  value: GuestRangeValue | null
  onChange: (val: GuestRangeValue | null) => void
  /** Counts above this trigger a soft "will become an inquiry" hint below the grid. */
  softThreshold?: number
}

// Grid shows every integer from GRID_MIN up to GRID_MAX_INCLUSIVE; beyond
// that one "50+" button opens a manual input for exact large-group counts
// between MANUAL_MIN and HARD_MAX. HARD_MAX is the venue's ceiling —
// anything larger cannot be accommodated at all.
const GRID_MIN = 5
const GRID_MAX_INCLUSIVE = 49
const MANUAL_MIN = 50
const HARD_MAX = 70

const GRID_PRESETS = Array.from(
  { length: GRID_MAX_INCLUSIVE - GRID_MIN + 1 },
  (_, i) => GRID_MIN + i,
)

function valueIsManual(v: GuestRangeValue | null): boolean {
  return v != null && v.min === v.max && v.max >= MANUAL_MIN
}

export function GuestRangePicker({ value, onChange, softThreshold }: Props) {
  const t = useTranslations('guestRangePicker')

  // Manual-input visibility is driven by the 50+ button and by external
  // value changes (e.g., URL prefill of 55). It stays open while the user
  // is typing, even if their transient text invalidates the value, so the
  // input doesn't vanish mid-edit.
  const [manualOpen, setManualOpen] = useState<boolean>(() => valueIsManual(value))
  const [manualText, setManualText] = useState<string>(() =>
    valueIsManual(value) ? String(value!.max) : '',
  )
  const [manualError, setManualError] = useState<string | null>(null)
  const manualInputRef = useRef<HTMLInputElement | null>(null)

  // External value entering manual range (e.g., URL prefill of 55) should
  // force manual mode on and seed the input. This is a genuine sync from an
  // outside source — the lint rule against setState-in-effect exists to
  // discourage derived-state antipatterns, which doesn't apply here.
  useEffect(() => {
    if (valueIsManual(value)) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setManualOpen(true)
      setManualText(String(value!.max))
      setManualError(null)
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [value])

  const mode: 'empty' | 'single' | 'range' | 'manual' = useMemo(() => {
    if (manualOpen) return 'manual'
    if (!value) return 'empty'
    if (value.min === value.max) return 'single'
    return 'range'
  }, [value, manualOpen])

  function handleGridClick(n: number) {
    setManualOpen(false)
    setManualText('')
    setManualError(null)
    if (!value || valueIsManual(value)) {
      onChange({ min: n, max: n })
      return
    }
    if (value.min === value.max) {
      if (n === value.min) return
      const min = Math.min(value.min, n)
      const max = Math.max(value.min, n)
      onChange({ min, max })
      return
    }
    // From a range, a third tap starts a new single.
    onChange({ min: n, max: n })
  }

  function handleEnterManual() {
    setManualOpen(true)
    setManualText(String(MANUAL_MIN))
    setManualError(null)
    onChange({ min: MANUAL_MIN, max: MANUAL_MIN })
    setTimeout(() => manualInputRef.current?.focus(), 0)
  }

  function handleManualTextChange(next: string) {
    const cleaned = next.replace(/\D+/g, '').slice(0, 3)
    setManualText(cleaned)
    if (cleaned === '') {
      setManualError(null)
      onChange(null)
      return
    }
    const n = parseInt(cleaned, 10)
    if (!Number.isFinite(n)) return
    if (n > HARD_MAX) {
      setManualError(t('overHardMax', { max: HARD_MAX }))
      onChange(null)
      return
    }
    setManualError(null)
    if (n < MANUAL_MIN) {
      // Mid-typing toward a valid value (e.g., "5" on the way to "55"). Don't
      // commit anything yet; the blur handler snaps the field back if they
      // leave it in this state.
      onChange(null)
      return
    }
    onChange({ min: n, max: n })
  }

  function handleManualBlur() {
    if (manualText === '') return
    const n = parseInt(manualText, 10)
    if (!Number.isFinite(n) || n < MANUAL_MIN || n > HARD_MAX) {
      setManualText(String(MANUAL_MIN))
      setManualError(null)
      onChange({ min: MANUAL_MIN, max: MANUAL_MIN })
    }
  }

  function handleReset() {
    setManualOpen(false)
    setManualText('')
    setManualError(null)
    onChange(null)
  }

  function presetState(n: number): 'anchor' | 'inside' | 'outside' | 'idle' {
    if (!value || manualOpen || valueIsManual(value)) return 'idle'
    if (n === value.min || n === value.max) return 'anchor'
    if (n > value.min && n < value.max) return 'inside'
    return 'outside'
  }

  const label = useMemo(() => {
    if (manualOpen) {
      if (manualError || !value) return t('emptyLabel')
      return t('singleLabel', { count: value.max })
    }
    if (!value) return t('emptyLabel')
    if (value.min === value.max) return t('singleLabel', { count: value.min })
    return t('rangeLabel', { min: value.min, max: value.max })
  }, [value, manualOpen, manualError, t])

  const overThreshold =
    softThreshold != null &&
    value != null &&
    value.max > softThreshold &&
    !manualError

  return (
    <div className="rounded-xl border border-[#E8ECE4] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[#1A1208]">{t('title')}</span>
        {(value || manualOpen) && (
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
        {GRID_PRESETS.map((n) => {
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
              onClick={() => handleGridClick(n)}
              aria-pressed={state === 'anchor' || state === 'inside'}
              aria-label={t('presetAria', { count: n })}
              className={`h-9 rounded-full border-none transition-colors text-[13px] font-semibold cursor-pointer ${buttonClass}`}
            >
              {n}
            </button>
          )
        })}
        <button
          type="button"
          onClick={handleEnterManual}
          aria-pressed={manualOpen}
          aria-label={t('manualButtonAria', { min: MANUAL_MIN, max: HARD_MAX })}
          className={`h-9 rounded-full border-none transition-colors text-[13px] font-semibold cursor-pointer ${
            manualOpen
              ? 'bg-[#6B7F5E] text-white shadow-sm'
              : 'bg-transparent text-[#1A1208] hover:bg-[#E8ECE4]'
          }`}
        >
          {MANUAL_MIN}+
        </button>
      </div>

      {manualOpen && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <label htmlFor="guest-manual-input" className="text-sm font-medium text-[#1A1208]">
            {t('manualInputLabel')}
          </label>
          <input
            ref={manualInputRef}
            id="guest-manual-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={manualText}
            onChange={(e) => handleManualTextChange(e.target.value)}
            onBlur={handleManualBlur}
            aria-label={t('manualInputLabel')}
            aria-invalid={manualError != null}
            style={{ outline: 'none', border: manualError ? '1px solid #C4453A' : '1px solid #E8ECE4' }}
            className="w-20 h-9 px-3 rounded-full bg-white text-[#1A1208] text-center text-[15px] font-semibold focus:!border-[#6B7F5E] transition-colors"
          />
          <span className="text-sm text-[#1A1208]">{t('manualInputUnit')}</span>
        </div>
      )}

      <p className="mt-3 text-center text-base font-semibold text-[#1A1208] min-h-[22px]">
        {label}
      </p>

      {mode === 'empty' && (
        <p className="mt-1 text-center text-xs text-[#1A1208]">{t('helpText')}</p>
      )}
      {(mode === 'single' || mode === 'manual') && !manualError && (
        <p className="mt-1 text-center text-xs text-[#1A1208]">{t('helpSingle')}</p>
      )}

      {manualError && (
        <p className="mt-2 text-center text-xs font-semibold text-[#C4453A]">{manualError}</p>
      )}

      {overThreshold && (
        <p className="mt-2 text-center text-xs text-[#8B6914] font-semibold">
          {t('overThresholdHint', { threshold: softThreshold! })}
        </p>
      )}
    </div>
  )
}
