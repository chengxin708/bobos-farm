"use client"

import { useIsMobile } from "@/hooks/useIsMobile"
import { useCreateReservationForm } from "./create-reservation/useCreateReservationForm"
import { CreateReservationModalDesktop } from "./create-reservation/ModalDesktop"
import { CreateReservationModalMobile } from "./create-reservation/ModalMobile"

interface Props {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
  defaultDate?: string
  defaultYurtId?: string
}

/**
 * Admin "create reservation" dialog. Dispatches to a dedicated desktop
 * layout (centered, two-column, scrollable body, sticky header + footer)
 * or mobile layout (full-screen sheet with pinned bottom action bar)
 * based on viewport width. Shared form state + submit logic live in
 * useCreateReservationForm; each layout only owns its chrome.
 */
export default function CreateReservationModal({
  isOpen,
  onClose,
  onCreated,
  defaultDate,
  defaultYurtId,
}: Props) {
  const isMobile = useIsMobile()
  const form = useCreateReservationForm({
    isOpen,
    defaultDate,
    defaultYurtId,
    onCreated,
    onClose,
  })

  if (isMobile) {
    return <CreateReservationModalMobile isOpen={isOpen} onClose={onClose} form={form} />
  }
  return <CreateReservationModalDesktop isOpen={isOpen} onClose={onClose} form={form} />
}
