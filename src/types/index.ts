import type {
  User,
  Yurt,
  YurtAvailability,
  MenuCategory,
  MenuItem,
  Reservation,
  Order,
  OrderItem,
  SystemSetting,
  RescheduleHistory,
  ActivityLog,
  ReservationStatus,
} from "@prisma/client";

// Re-export Prisma types
export type {
  User,
  Yurt,
  YurtAvailability,
  MenuCategory,
  MenuItem,
  Reservation,
  Order,
  OrderItem,
  SystemSetting,
  RescheduleHistory,
  ActivityLog,
  ReservationStatus,
};

// Extended types with relations
export type ReservationWithRelations = Reservation & {
  user: Pick<User, "id" | "name" | "email" | "phone">;
  yurt: Pick<Yurt, "id" | "name" | "capacity">;
  orders?: Array<Order & { items: (OrderItem & { menuItem: MenuItem })[] }>;
};

export type MenuItemWithCategory = MenuItem & {
  category: MenuCategory;
};

export type YurtWithAvailability = Yurt & {
  availability: YurtAvailability[];
};

// API Response types
export type ApiResponse<T> = {
  data?: T;
  error?: string;
  details?: unknown;
};

// Safe DTO types — never leak internal fields

/** Safe user type for API responses — omits passwordHash */
export type UserDto = Omit<User, "passwordHash">;

/** Full reservation detail for admin reservation detail panel */
export type ReservationDetailDto = ReservationWithRelations & {
  rescheduleHistory: RescheduleHistory[];
  activityLogs: ActivityLog[];
};

/** Yurt availability slot for calendar and booking flow */
export type YurtAvailabilityDto = {
  yurtId: string;
  yurtName: string;
  date: string;
  isOpen: boolean;
  hasReservation: boolean;
  reservationStatus?: ReservationStatus;
};

/** Deposit record for admin deposits page */
export type DepositDto = Pick<
  Reservation,
  | "id"
  | "date"
  | "guestCount"
  | "depositAmount"
  | "depositStatus"
  | "paymentReference"
  | "paymentDeadline"
  | "createdAt"
> & {
  user: Pick<User, "name" | "email" | "phone">;
  yurt: Pick<Yurt, "name">;
};

/** System setting without internal id/updatedAt fields */
export type SystemSettingDto = Pick<SystemSetting, "key" | "value" | "description">;

// Auth types
declare module "next-auth" {
  interface User {
    role?: string;
    preferredLanguage?: string;
  }
  interface Session {
    user: {
      id: string;
      role: string;
      preferredLanguage: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    id?: string;
    preferredLanguage?: string;
  }
}
