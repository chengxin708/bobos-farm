"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, Loader2 } from "lucide-react"
import { FormFields } from "./FormFields"
import { ConvertSuccessScreen } from "./SuccessScreen"
import type { ConvertInquiryFormModel } from "./useConvertInquiryForm"

interface Props {
  isOpen: boolean
  onClose: () => void
  onViewReservation: (reservationId: string) => void
  form: ConvertInquiryFormModel
}

export function ConvertInquiryModalMobile({
  isOpen,
  onClose,
  onViewReservation,
  form,
}: Props) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!isOpen) return
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [isOpen])

  if (!isOpen) return null

  const inSuccess = form.result != null

  return (
    <div className={`fixed inset-0 z-[70] transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}>
      <div className="bg-[#F8F7F4] w-full h-full flex flex-col">
        <div className="shrink-0 flex items-center h-14 px-4 bg-white border-b border-[#E8ECE4]">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-[#6B7F5E] font-semibold border-none bg-transparent cursor-pointer"
          >
            <ArrowLeft size={16} />
            {inSuccess ? form.t("successHeader") : form.t("title")}
          </button>
        </div>

        {inSuccess ? (
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
            <ConvertSuccessScreen
              form={form}
              onDone={onClose}
              onViewReservation={onViewReservation}
            />
          </div>
        ) : (
          <>
            <form
              id="convert-inquiry-form-mobile"
              onSubmit={form.handleSubmit}
              className="flex-1 min-h-0 overflow-y-auto px-4 py-4 pb-24"
            >
              <FormFields form={form} />
            </form>

            <div
              className="shrink-0 flex items-center gap-3 px-4 py-3 bg-white border-t border-[#E8ECE4]"
              style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
            >
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-11 rounded-lg text-sm font-medium border border-[#E8E2D9] bg-white cursor-pointer"
                style={{ color: "#2C2416" }}
              >
                {form.t("cancel")}
              </button>
              <button
                type="submit"
                form="convert-inquiry-form-mobile"
                disabled={form.submitting}
                className="flex-[2] h-11 rounded-lg text-sm font-semibold text-white border-none disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                style={{ backgroundColor: form.submitting ? "#5A6E4F" : "#6B7F5E" }}
              >
                {form.submitting && <Loader2 size={14} className="animate-spin" />}
                {form.submitting ? form.t("converting") : form.t("convert")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
