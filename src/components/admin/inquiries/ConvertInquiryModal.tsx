"use client"

import { useIsMobile } from "@/hooks/useIsMobile"
import { useConvertInquiryForm } from "@/components/admin/convert-inquiry/useConvertInquiryForm"
import { ConvertInquiryModalDesktop } from "@/components/admin/convert-inquiry/ModalDesktop"
import { ConvertInquiryModalMobile } from "@/components/admin/convert-inquiry/ModalMobile"

interface ConvertInquiryModalProps {
  inquiryId: string
  defaultDate: string
  defaultGuestCount: number
  onCancel: () => void
  onConverted: (reservationId: string) => void
}

/**
 * Admin "convert inquiry to reservation" dialog. Thin dispatcher — the
 * actual logic and UI live in src/components/admin/convert-inquiry/*
 * and are split between desktop + mobile chrome behind useIsMobile().
 *
 * After a successful conversion, the dialog switches to a SuccessScreen
 * that shows the new confirmation code, a claim URL with copy button,
 * and a ready-to-paste customer message template (iMessage / WeChat).
 * onConverted fires when the admin explicitly chooses "View reservation"
 * so the success screen has a chance to display first.
 */
export default function ConvertInquiryModal({
  inquiryId,
  defaultDate,
  defaultGuestCount,
  onCancel,
  onConverted,
}: ConvertInquiryModalProps) {
  const isMobile = useIsMobile()
  const form = useConvertInquiryForm({
    inquiryId,
    isOpen: true,
    defaultDate,
    defaultGuestCount,
    onCancel,
  })
  if (isMobile) {
    return (
      <ConvertInquiryModalMobile
        isOpen
        onClose={onCancel}
        onViewReservation={onConverted}
        form={form}
      />
    )
  }
  return (
    <ConvertInquiryModalDesktop
      isOpen
      onClose={onCancel}
      onViewReservation={onConverted}
      form={form}
    />
  )
}
