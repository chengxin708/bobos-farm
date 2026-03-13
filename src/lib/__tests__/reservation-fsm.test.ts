import {
  VALID_TRANSITIONS,
  canTransition,
  assertTransition,
  getValidActions,
  getActionTransition,
} from '../reservation-fsm';
import { ReservationStatus } from '@prisma/client';

const {
  PENDING_PAYMENT,
  PAYMENT_SUBMITTED,
  CONFIRMED,
  COMPLETED,
  CANCELLED,
  EXPIRED,
} = ReservationStatus;

describe('VALID_TRANSITIONS', () => {
  it('should have exactly 7 transitions', () => {
    expect(VALID_TRANSITIONS).toHaveLength(7);
  });
});

describe('canTransition', () => {
  it('returns true for PENDING_PAYMENT -> PAYMENT_SUBMITTED', () => {
    expect(canTransition(PENDING_PAYMENT, PAYMENT_SUBMITTED)).toBe(true);
  });

  it('returns true for PENDING_PAYMENT -> EXPIRED', () => {
    expect(canTransition(PENDING_PAYMENT, EXPIRED)).toBe(true);
  });

  it('returns true for PENDING_PAYMENT -> CANCELLED', () => {
    expect(canTransition(PENDING_PAYMENT, CANCELLED)).toBe(true);
  });

  it('returns true for PAYMENT_SUBMITTED -> CONFIRMED', () => {
    expect(canTransition(PAYMENT_SUBMITTED, CONFIRMED)).toBe(true);
  });

  it('returns true for PAYMENT_SUBMITTED -> CANCELLED (reject deposit)', () => {
    expect(canTransition(PAYMENT_SUBMITTED, CANCELLED)).toBe(true);
  });

  it('returns true for CONFIRMED -> COMPLETED', () => {
    expect(canTransition(CONFIRMED, COMPLETED)).toBe(true);
  });

  it('returns true for CONFIRMED -> CANCELLED', () => {
    expect(canTransition(CONFIRMED, CANCELLED)).toBe(true);
  });

  it('returns false for EXPIRED -> CONFIRMED (expired cannot be confirmed)', () => {
    expect(canTransition(EXPIRED, CONFIRMED)).toBe(false);
  });

  it('returns false for COMPLETED -> CANCELLED (completed is terminal)', () => {
    expect(canTransition(COMPLETED, CANCELLED)).toBe(false);
  });

  it('returns false for CANCELLED -> PENDING_PAYMENT (cancelled is terminal)', () => {
    expect(canTransition(CANCELLED, PENDING_PAYMENT)).toBe(false);
  });
});

describe('assertTransition', () => {
  it('does not throw for a valid transition', () => {
    expect(() => assertTransition(PENDING_PAYMENT, PAYMENT_SUBMITTED)).not.toThrow();
  });

  it('throws Error with "Invalid transition" for EXPIRED -> CONFIRMED', () => {
    expect(() => assertTransition(EXPIRED, CONFIRMED)).toThrow(/Invalid transition/);
  });

  it('throws Error with "Invalid transition" for COMPLETED -> CANCELLED', () => {
    expect(() => assertTransition(COMPLETED, CANCELLED)).toThrow(/Invalid transition/);
  });
});

describe('getValidActions', () => {
  it('returns [SUBMIT_PAYMENT, EXPIRE, CANCEL] for PENDING_PAYMENT', () => {
    const actions = getValidActions(PENDING_PAYMENT);
    expect(actions).toHaveLength(3);
    expect(actions).toContain('SUBMIT_PAYMENT');
    expect(actions).toContain('EXPIRE');
    expect(actions).toContain('CANCEL');
  });

  it('returns [] for COMPLETED (terminal state)', () => {
    expect(getValidActions(COMPLETED)).toEqual([]);
  });

  it('returns [] for CANCELLED (terminal state)', () => {
    expect(getValidActions(CANCELLED)).toEqual([]);
  });

  it('returns [] for EXPIRED (terminal state)', () => {
    expect(getValidActions(EXPIRED)).toEqual([]);
  });

  it('returns [CONFIRM_DEPOSIT, REJECT_DEPOSIT] for PAYMENT_SUBMITTED', () => {
    const actions = getValidActions(PAYMENT_SUBMITTED);
    expect(actions).toHaveLength(2);
    expect(actions).toContain('CONFIRM_DEPOSIT');
    expect(actions).toContain('REJECT_DEPOSIT');
  });

  it('returns [COMPLETE, CANCEL] for CONFIRMED', () => {
    const actions = getValidActions(CONFIRMED);
    expect(actions).toHaveLength(2);
    expect(actions).toContain('COMPLETE');
    expect(actions).toContain('CANCEL');
  });
});

describe('getActionTransition', () => {
  it('returns the transition for a known action', () => {
    const t = getActionTransition('SUBMIT_PAYMENT');
    expect(t).toBeDefined();
    expect(t!.from).toBe(PENDING_PAYMENT);
    expect(t!.to).toBe(PAYMENT_SUBMITTED);
    expect(t!.action).toBe('SUBMIT_PAYMENT');
  });

  it('returns undefined for an unknown action', () => {
    expect(getActionTransition('NONEXISTENT_ACTION')).toBeUndefined();
  });
});
