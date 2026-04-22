"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, Loader2 } from "lucide-react"
import { FormFields } from "./FormFields"
import type { CreateInquiryFormModel } from "./useCreateInquiryForm"

interface Props {
  isOpen: boolean
  onClose: () => void
  form: CreateInquiryFormModel
}

export function CreateInquiryModalMobile({ isOpen, onClose, form }: Props) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!isOpen) return
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className={`fixed inset-0 z-50 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}>
      <div className="bg-[#F8F7F4] w-full h-full flex flex-col">
        <div className="shrink-0 flex items-center h-14 px-4 bg-white border-b border-[#E8ECE4]">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-[#6B7F5E] font-semibold border-none bg-transparent cursor-pointer"
          >
            <ArrowLeft size={16} />
            {form.t("title")}
          </button>
        </div>

        <form
          id="create-inquiry-form-mobile"
          onSubmit={form.handleSubmit}
          className="flex-1 min-h-0 overflow-y-auto px-4 py-4 pb-24"
        >
          <FormFields form={form} layout="single" />
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
            form="create-inquiry-form-mobile"
            disabled={form.submitting}
            className="flex-[2] h-11 rounded-lg text-sm font-semibold text-white border-none disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            style={{ backgroundColor: form.submitting ? "#5A6E4F" : "#6B7F5E" }}
          >
            {form.submitting && <Loader2 size={14} className="animate-spin" />}
            {form.submitting ? form.t("creating") : form.t("submit")}
          </button>
        </div>
      </div>
    </div>
  )
}
