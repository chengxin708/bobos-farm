import { ReservationStatus } from "@prisma/client";

export const INACTIVE_RESERVATION_STATUSES: ReservationStatus[] = [
  "CANCELLED",
  "CANCELLED_PENDING_REFUND",
  "EXPIRED",
];

export type Transition = {
  from: ReservationStatus;
  to: ReservationStatus;
  action: string;
};

/**
 * The single source of truth for valid reservation state transitions.
 * All booking, deposit, and admin workflows must use these transitions.
 */
export const VALID_TRANSITIONS: Transition[] = [
  {
    from: ReservationStatus.PENDING_PAYMENT,
    to: ReservationStatus.PAYMENT_SUBMITTED,
    action: "SUBMIT_PAYMENT",
  },
  {
    from: ReservationStatus.PENDING_PAYMENT,
    to: ReservationStatus.EXPIRED,
    action: "EXPIRE",
  },
  {
    from: ReservationStatus.PENDING_PAYMENT,
    to: ReservationStatus.CANCELLED,
    action: "CANCEL",
  },
  {
    from: ReservationStatus.PAYMENT_SUBMITTED,
    to: ReservationStatus.CONFIRMED,
    action: "CONFIRM_DEPOSIT",
  },
  {
    from: ReservationStatus.PAYMENT_SUBMITTED,
    to: ReservationStatus.CANCELLED,
    action: "REJECT_DEPOSIT",
  },
  {
    from: ReservationStatus.CONFIRMED,
    to: ReservationStatus.COMPLETED,
    action: "COMPLETE",
  },
  {
    from: ReservationStatus.CONFIRMED,
    to: ReservationStatus.CANCELLED,
    action: "CANCEL",
  },
];

/**
 * Returns true if transitioning from `from` to `to` is a valid state change.
 */
export function canTransition(
  from: ReservationStatus,
  to: ReservationStatus
): boolean {
  return VALID_TRANSITIONS.some((t) => t.from === from && t.to === to);
}

/**
 * Asserts that the transition from `from` to `to` is valid.
 * Throws an Error with "Invalid transition" in the message if not.
 */
export function assertTransition(
  from: ReservationStatus,
  to: ReservationStatus
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid transition: ${from} -> ${to}`
    );
  }
}

/**
 * Returns all valid action names from a given state.
 * Returns an empty array for terminal states (COMPLETED, CANCELLED, EXPIRED).
 */
export function getValidActions(from: ReservationStatus): string[] {
  return VALID_TRANSITIONS.filter((t) => t.from === from).map((t) => t.action);
}

/**
 * Reverse lookup: find the transition that corresponds to a given action name.
 * Returns undefined if the action is not found.
 */
export function getActionTransition(action: string): Transition | undefined {
  return VALID_TRANSITIONS.find((t) => t.action === action);
}
