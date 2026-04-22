"use client"

import { useIsMobile } from "@/hooks/useIsMobile"
import { useCreateInquiryForm } from "./create-inquiry/useCreateInquiryForm"
import { CreateInquiryModalDesktop } from "./create-inquiry/ModalDesktop"
import { CreateInquiryModalMobile } from "./create-inquiry/ModalMobile"

interface Props {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
  defaultDate?: string
}

/**
 * Admin "create inquiry" dialog. Dispatches to a desktop layout (centered,
 * two-column, scrollable body, sticky header + footer) or mobile layout
 * (full-screen sheet with pinned bottom action bar) based on viewport
 * width. Same pattern as CreateReservationModal.
 */
export default function CreateInquiryModal({ isOpen, onClose, onCreated, defaultDate }: Props) {
  const isMobile = useIsMobile()
  const form = useCreateInquiryForm({ isOpen, defaultDate, onCreated, onClose })
  if (isMobile) {
    return <CreateInquiryModalMobile isOpen={isOpen} onClose={onClose} form={form} />
  }
  return <CreateInquiryModalDesktop isOpen={isOpen} onClose={onClose} form={form} />
}
