"use client"

// The form model returned from useCreateReservationForm includes a
// RefObject (nameInputRef), and the react-hooks/refs lint rule then
// flags every property access on the object as a potential ref read.
// All accesses below are plain state values, not ref.current reads —
// the ref itself is only passed to `ref={}` which is the correct use.
/* eslint-disable react-hooks/refs */

import type { CreateReservationFormModel } from "./useCreateReservationForm"

const FIELD_BASE_STYLE: React.CSSProperties = {
  borderColor: "#E8E2D9",
  backgroundColor: "#FFFFFF",
  color: "#2C2416",
}
const FIELD_BASE_CLASS =
  "h-11 px-3 rounded-lg border outline-none transition-all duration-150 bg-white"

function handleFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = "#6B7F5E"
  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(107,127,94,0.15)"
}
function handleBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = "#E8E2D9"
  e.currentTarget.style.boxShadow = "none"
}

/**
 * All fields for the create-reservation form, shared across mobile + desktop
 * layouts. The `layout` prop just swaps the outer grid between single-column
 * (mobile) and two-column (desktop) — individual inputs stay identical.
 */
export function FormFields({
  form,
  layout,
}: {
  form: CreateReservationFormModel
  layout: "single" | "two-col"
}) {
  const { t, isAdmin } = form

  const gridClass =
    layout === "two-col"
      ? "grid grid-cols-2 gap-x-4 gap-y-4"
      : "flex flex-col gap-4"

  return (
    <div className="flex flex-col gap-4">
      {form.isPastDate && (
        <div className="rounded-lg border border-[#E8B730]/40 bg-[#FFF8E1] px-3 py-2.5 flex items-start gap-2">
          <span className="text-base">⚠️</span>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-[#8B6914]">{t("pastDateBanner")}</p>
            <p className="text-[12px] text-[#8B6914]/85 mt-0.5">{t("pastDateBannerHint")}</p>
          </div>
        </div>
      )}

      <div className={gridClass}>
        <div className={layout === "two-col" ? "col-span-2" : ""}>
          <FieldLabel required>{t("guestName")}</FieldLabel>
          <input
            ref={form.nameInputRef}
            type="text"
            required
            value={form.guestName}
            onChange={(e) => form.setGuestName(e.target.value)}
            placeholder={t("guestNamePlaceholder")}
            className={FIELD_BASE_CLASS}
            style={FIELD_BASE_STYLE}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </div>

        <div>
          <FieldLabel>{t("guestEmail")}</FieldLabel>
          <input
            type="email"
            value={form.guestEmail}
            onChange={(e) => form.setGuestEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            className={FIELD_BASE_CLASS}
            style={FIELD_BASE_STYLE}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </div>

        <div>
          <FieldLabel>{t("guestPhone")}</FieldLabel>
          <input
            type="tel"
            value={form.guestPhone}
            onChange={(e) => form.setPhoneWithMask(e.target.value)}
            placeholder={t("phonePlaceholder")}
            className={FIELD_BASE_CLASS}
            style={FIELD_BASE_STYLE}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </div>

        <div className={layout === "two-col" ? "col-span-2" : ""}>
          <FieldLabel>{t("guestWechat")}</FieldLabel>
          <input
            type="text"
            value={form.guestWechatId}
            onChange={(e) => form.setGuestWechatId(e.target.value)}
            placeholder={t("wechatPlaceholder")}
            className={FIELD_BASE_CLASS}
            style={FIELD_BASE_STYLE}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
          <p className="text-[11px] text-[#8C8478] mt-1">{t("contactHint")}</p>
        </div>

        <div>
          <FieldLabel required>{t("date")}</FieldLabel>
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => form.setDate(e.target.value)}
            className={FIELD_BASE_CLASS}
            style={FIELD_BASE_STYLE}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </div>

        <div>
          <FieldLabel required>{t("guestCount")}</FieldLabel>
          <input
            type="number"
            required
            min={1}
            value={form.guestCount}
            onChange={(e) => form.setGuestCount(parseInt(e.target.value) || 1)}
            className={FIELD_BASE_CLASS}
            style={FIELD_BASE_STYLE}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </div>
      </div>

      {/* Yurt assignment — always full-width */}
      <div className="flex flex-col gap-2">
        <FieldLabel>{t("selectYurt")}</FieldLabel>

        {form.isOverAllocated && (
          <div className="rounded-lg border border-[#DC3545]/30 bg-[#FDECEA] px-3 py-2 flex items-start gap-2">
            <span className="text-base">⚠️</span>
            <p className="text-[12px] text-[#991B1B] leading-snug">
              {t("overAllocatedBanner", {
                reservationCount: form.reservationCount,
                yurtCount: form.activeYurtCount,
              })}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {(["auto", "specific", "hold"] as const).map((mode) => {
            const hintKey =
              mode === "auto"
                ? "autoAssignHint"
                : mode === "specific"
                  ? "specificYurtsHint"
                  : "holdNoAssignHint"
            return (
              <label
                key={mode}
                className="flex items-start gap-2 text-sm text-[#2C2416] cursor-pointer"
              >
                <input
                  type="radio"
                  name="yurtMode"
                  className="mt-0.5"
                  checked={form.yurtMode === mode}
                  onChange={() => {
                    form.setYurtMode(mode)
                  }}
                />
                <span className="flex-1">
                  <span className="font-medium">
                    {mode === "auto"
                      ? t("autoAssign")
                      : mode === "specific"
                        ? t("specificYurts")
                        : t("holdNoAssign")}
                  </span>
                  <span className="block text-[11px] text-[#8C8478] leading-snug mt-0.5">
                    {t(hintKey)}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
        {form.yurtMode === "specific" && (
          <div
            className={`flex flex-col gap-1 mt-1 pl-2 border-l-2 transition-colors ${
              form.error === t("selectAtLeastOneYurt")
                ? "border-[#DC3545]"
                : "border-[#E8E2D9]"
            }`}
          >
            {form.activeYurts.map((y) => {
              const isOccupied = form.occupiedYurtIds.has(y.id)
              const checked = form.yurtIds.includes(y.id)
              return (
                <label
                  key={y.id}
                  className={`flex items-center gap-2 text-sm py-1 ${
                    isOccupied ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                  }`}
                  style={{ color: "#2C2416" }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isOccupied}
                    onChange={(e) => form.toggleYurt(y.id, e.target.checked)}
                  />
                  <span className="flex-1">
                    {t("yurtCapacity", {
                      name: `${y.name}${y.alias ? ` (${y.alias})` : ""}`,
                      capacity: y.capacity,
                    })}
                    {isOccupied ? ` — ${t("occupied")}` : ""}
                  </span>
                </label>
              )
            })}
            {form.selectedYurtsCount > 0 && (() => {
              const override =
                form.customDeposit !== "" ? Number(form.customDeposit) : null
              const total = override !== null && Number.isFinite(override)
                ? override
                : form.selectedYurtsCount * 300
              return (
                <p className="text-xs mt-2 text-[#6B7F5E] font-medium">
                  {override !== null
                    ? t("multiDepositHintCustom", { total })
                    : t("multiDepositHint", { count: form.selectedYurtsCount, total })}
                </p>
              )
            })()}
          </div>
        )}
        {form.capacityExceeded && (
          <p className="text-xs mt-1" style={{ color: "#DC3545" }}>
            ⚠️ {t("capacityWarning", { guests: form.guestCount, capacity: form.combinedCapacity })}
          </p>
        )}
        {form.selectedYurtOccupied && (
          <p className="text-xs mt-1" style={{ color: "#DC3545" }}>
            ⚠️ {t("yurtOccupied")}
          </p>
        )}
        {form.noRoomAvailable && (
          <p className="text-xs mt-1" style={{ color: "#DC3545" }}>
            ⚠️ {t("noRoomAvailable")}
          </p>
        )}
      </div>

      <div>
        <FieldLabel>{t("specialRequests")}</FieldLabel>
        <textarea
          value={form.specialRequests}
          onChange={(e) => form.setSpecialRequests(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder={t("specialRequestsPlaceholder")}
          className="px-3 py-2.5 rounded-lg border outline-none transition-all duration-150 resize-none bg-white w-full"
          style={{ borderColor: "#E8E2D9", color: "#2C2416" }}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        <span className="block text-[11px] text-right mt-1" style={{ color: "#8A7E6B" }}>
          {form.specialRequests.length}/500
        </span>
      </div>

      {isAdmin && (
        <div>
          <FieldLabel>{t("depositAmount")}</FieldLabel>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: "#2C2416" }}>$</span>
            <input
              type="number"
              min="0"
              step="1"
              value={form.customDeposit}
              onChange={(e) => form.setCustomDeposit(e.target.value)}
              placeholder={t("depositDefault")}
              className={`${FIELD_BASE_CLASS} flex-1`}
              style={FIELD_BASE_STYLE}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>
          <p className="text-xs mt-1" style={{ color: "#8C8478" }}>{t("depositHint")}</p>
        </div>
      )}

      {form.error && (
        <div
          className="px-3 py-2 rounded-lg text-sm"
          style={{
            backgroundColor: "#FEF2F2",
            color: "#991B1B",
            border: "1px solid #FECACA",
          }}
        >
          {form.error}
        </div>
      )}
    </div>
  )
}

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <label
      className="block text-[13px] font-semibold mb-1.5"
      style={{ color: "#2C2416" }}
    >
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  )
}
