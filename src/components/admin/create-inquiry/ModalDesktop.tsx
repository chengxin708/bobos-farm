"use client"

import { useEffect, useState } from "react"
import { X, Loader2 } from "lucide-react"
import { FormFields } from "./FormFields"
import type { CreateInquiryFormModel } from "./useCreateInquiryForm"

interface Props {
  isOpen: boolean
  onClose: () => void
  form: CreateInquiryFormModel
}

export function CreateInquiryModalDesktop({ isOpen, onClose, form }: Props) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!isOpen) return
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-6 transition-all duration-200 ${
        visible ? "bg-black/40" : "bg-black/0"
      }`}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"
        }`}
        style={{ maxHeight: "calc(100dvh - 3rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-[#E8E2D9]">
          <h2
            className="text-xl font-bold"
            style={{ fontFamily: "var(--font-playfair)", color: "#2C2416" }}
          >
            {form.t("title")}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#F5F2ED] transition-colors border-none bg-transparent cursor-pointer"
            aria-label={form.t("cancel")}
          >
            <X size={18} style={{ color: "#8A7E6B" }} />
          </button>
        </div>

        <form
          id="create-inquiry-form-desktop"
          onSubmit={form.handleSubmit}
          className="flex-1 min-h-0 overflow-y-auto px-6 py-5"
        >
          <FormFields form={form} layout="two-col" />
        </form>

        <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E8E2D9] bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-[#F5F2ED] border-none bg-transparent cursor-pointer"
            style={{ color: "#2C2416" }}
          >
            {form.t("cancel")}
          </button>
          <button
            type="submit"
            form="create-inquiry-form-desktop"
            disabled={form.submitting}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white border-none transition-colors disabled:opacity-60 flex items-center gap-2 cursor-pointer"
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
