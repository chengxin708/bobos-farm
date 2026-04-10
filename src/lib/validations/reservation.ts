import { z } from "zod";

export const createReservationSchema = z.object({
  yurtId: z.string().min(1, "Please select a yurt"),
  date: z.string().min(1, "Please select a date"),
  guestCount: z.number().min(1, "At least 1 guest required"),
  contactName: z.string().min(2, "Contact name is required"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().min(1, "Phone number is required"),
  specialRequests: z.string().optional(),
});

export const rescheduleSchema = z.object({
  reservationId: z.string(),
  newDate: z.string(),
  newYurtId: z.string(),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type RescheduleInput = z.infer<typeof rescheduleSchema>;
