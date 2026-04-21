"use client"

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Minus, Plus } from 'lucide-react'

interface Props {
  value: number | null
  onChange: (n: number | null) => void
  /** Smallest count the stepper allows (default 1). */
  min?: number
  /** Absolute venue ceiling — the + button disables above this. Default 70. */
  hardMax?: number
  /**
   * Self-serve cap for this date. Counts above this still work (the venue
   * accepts inquiries up to hardMax) but trigger the amber inquiry hint.
   * If omitted, the hint is suppressed.
   */
  softThreshold?: number
}

const DEFAULT_MIN = 1
const DEFAULT_HARD_MAX = 70

/**
 * Generate quick-select chips from the usable range. The list tops out at
 * the softThreshold (or hardMax if there's no soft limit) so chips never
 * invite users to blow past the self-serve cap. The spacing is chosen to
 * match common party sizes: small groups get tight resolution, larger
 * groups get coarser steps.
 */
function buildChips(min: number, cap: number): number[] {
  const bases = [5, 8, 12, 16, 20, 25, 30, 40, 50, 60, 70]
  const chips = bases.filter((n) => n >= min && n <= cap)
  // Always include the cap itself as the last chip so users can one-tap
  // fill to the maximum allowed count (especially useful when the cap has
  // shrunk to 16 or 25 because larger yurts are booked).
  if (cap >= min && !chips.includes(cap)) chips.push(cap)
  return chips
}

export function GuestCountPicker({
  value,
  onChange,
  min = DEFAULT_MIN,
  hardMax = DEFAULT_HARD_MAX,
  softThreshold,
}: Props) {
  const t = useTranslations('guestCountPicker')

  const displayValue = value ?? min
  const canDecrement = value != null && value > min
  const canIncrement = (value ?? min - 1) < hardMax

  // The cap used to build chips: prefer softThreshold (so chips stop at
  // today's self-serve max) but fall back to hardMax when the whole venue
  // is open for self-serve.
  const chipCap = softThreshold ?? hardMax
  const chips = useMemo(() => buildChips(min, chipCap), [min, chipCap])

  const overSoft = softThreshold != null && value != null && value > softThreshold
  const atHardMax = value != null && value >= hardMax

  function commit(n: number) {
    const clamped = Math.max(min, Math.min(hardMax, n))
    onChange(clamped)
  }

  return (
    <div className="rounded-xl border border-[#E8ECE4] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[#1A1208]">{t('title')}</span>
        {value != null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs font-semibold text-[#1A1208] hover:underline transition-colors border-none bg-transparent cursor-pointer"
          >
            {t('reset')}
          </button>
        )}
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => canDecrement && commit(displayValue - 1)}
          disabled={!canDecrement}
          aria-label={t('decrement')}
          className={`w-12 h-12 rounded-full border border-[#E8ECE4] flex items-center justify-center transition-colors ${
            canDecrement
              ? 'bg-white text-[#1A1208] cursor-pointer hover:bg-[#E8ECE4]/60'
              : 'bg-[#F2EDE6]/60 text-[#1A1208]/30 cursor-not-allowed'
          }`}
        >
          <Minus size={20} />
        </button>

        <div className="min-w-[72px] text-center">
          <span
            className={`text-3xl font-serif font-semibold ${
              value == null ? 'text-[#1A1208]/30' : 'text-[#1A1208]'
            }`}
          >
            {value ?? min}
          </span>
          <div className="text-xs text-[#1A1208] mt-0.5">{t('unit')}</div>
        </div>

        <button
          type="button"
          onClick={() => canIncrement && commit(displayValue + 1)}
          disabled={!canIncrement}
          aria-label={t('increment')}
          className={`w-12 h-12 rounded-full border border-[#E8ECE4] flex items-center justify-center transition-colors ${
            canIncrement
              ? 'bg-white text-[#1A1208] cursor-pointer hover:bg-[#E8ECE4]/60'
              : 'bg-[#F2EDE6]/60 text-[#1A1208]/30 cursor-not-allowed'
          }`}
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
        {chips.map((n) => {
          const active = value === n
          return (
            <button
              key={n}
              type="button"
              onClick={() => commit(n)}
              aria-pressed={active}
              aria-label={t('chipAria', { count: n })}
              className={`h-8 px-3 rounded-full border-none text-[13px] font-semibold cursor-pointer transition-colors ${
                active
                  ? 'bg-[#6B7F5E] text-white shadow-sm'
                  : 'bg-[#F2EDE6] text-[#1A1208] hover:bg-[#E8ECE4]'
              }`}
            >
              {n}
            </button>
          )
        })}
      </div>

      {value == null && (
        <p className="mt-3 text-center text-xs text-[#1A1208]">{t('helpText')}</p>
      )}
      {value != null && !overSoft && !atHardMax && (
        <p className="mt-3 text-center text-xs text-[#1A1208]">{t('helpSingle')}</p>
      )}

      {overSoft && !atHardMax && (
        <p className="mt-3 text-center text-xs font-semibold text-[#8B6914]">
          {t('overThresholdHint', { threshold: softThreshold! })}
        </p>
      )}

      {atHardMax && (
        <p className="mt-3 text-center text-xs font-semibold text-[#C4453A]">
          {t('atHardMaxHint', { max: hardMax })}
        </p>
      )}
    </div>
  )
}
