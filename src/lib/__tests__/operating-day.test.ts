import type { Prisma } from '@prisma/client';
import { autoPromoteIfClosed } from '../operating-day';

interface FakeOpRow {
  id: string;
  date: Date;
  mode: 'OPEN' | 'PRIVATE_EVENT' | 'CLOSED';
  note: string | null;
  createdBy: string | null;
  createdAt: Date;
}

interface UpsertCall {
  where: { date: Date };
  create: {
    date: Date;
    mode: 'OPEN' | 'PRIVATE_EVENT' | 'CLOSED';
    note: string;
    createdBy: string;
  };
  update: {
    mode: 'OPEN' | 'PRIVATE_EVENT' | 'CLOSED';
    note: string;
  };
}

function makeFakeTx(initialRow: FakeOpRow | null = null) {
  const calls: { findUnique: number; upsert: UpsertCall[] } = {
    findUnique: 0,
    upsert: [],
  };
  const tx = {
    operatingDay: {
      findUnique: async (_args: unknown) => {
        calls.findUnique++;
        return initialRow;
      },
      upsert: async (args: UpsertCall) => {
        calls.upsert.push(args);
        return args.create as unknown as FakeOpRow;
      },
    },
  };
  return { tx: tx as unknown as Prisma.TransactionClient, calls };
}

describe('autoPromoteIfClosed', () => {
  it('does nothing when row is OPEN', async () => {
    const existing: FakeOpRow = {
      id: '1',
      date: new Date('2026-05-04T00:00:00Z'),
      mode: 'OPEN',
      note: null,
      createdBy: null,
      createdAt: new Date(),
    };
    const { tx, calls } = makeFakeTx(existing);
    await autoPromoteIfClosed(tx, new Date('2026-05-04T00:00:00Z'), 'admin-1', 'note');
    expect(calls.upsert).toHaveLength(0);
  });

  it('does nothing when row is PRIVATE_EVENT', async () => {
    const existing: FakeOpRow = {
      id: '1',
      date: new Date('2026-05-04T00:00:00Z'),
      mode: 'PRIVATE_EVENT',
      note: null,
      createdBy: null,
      createdAt: new Date(),
    };
    const { tx, calls } = makeFakeTx(existing);
    await autoPromoteIfClosed(tx, new Date('2026-05-04T00:00:00Z'), 'admin-1', 'note');
    expect(calls.upsert).toHaveLength(0);
  });

  it('upserts PRIVATE_EVENT when row is CLOSED', async () => {
    const existing: FakeOpRow = {
      id: '1',
      date: new Date('2026-05-04T00:00:00Z'),
      mode: 'CLOSED',
      note: null,
      createdBy: null,
      createdAt: new Date(),
    };
    const { tx, calls } = makeFakeTx(existing);
    await autoPromoteIfClosed(tx, new Date('2026-05-04T00:00:00Z'), 'admin-1', 'note');
    expect(calls.upsert).toHaveLength(1);
    expect(calls.upsert[0].create.mode).toBe('PRIVATE_EVENT');
    expect(calls.upsert[0].create.note).toBe('note');
    expect(calls.upsert[0].create.createdBy).toBe('admin-1');
  });

  it('upserts when no row exists and date is a weekday', async () => {
    const { tx, calls } = makeFakeTx(null);
    // Monday in ET (use noon UTC = same calendar date in ET, so the helper's
    // internal noon-UTC anchor reads as Monday)
    await autoPromoteIfClosed(tx, new Date('2026-05-04T00:00:00Z'), 'admin-1', 'note');
    expect(calls.upsert).toHaveLength(1);
  });

  it('does nothing when no row exists and date is a weekend', async () => {
    const { tx, calls } = makeFakeTx(null);
    // Saturday in ET
    await autoPromoteIfClosed(tx, new Date('2026-05-02T00:00:00Z'), 'admin-1', 'note');
    expect(calls.upsert).toHaveLength(0);
  });

  it('handles @db.Date midnight-UTC values: a stored Saturday is correctly NOT promoted', async () => {
    // Without the noon-UTC anchor, midnight-UTC Saturday reads as Friday in ET (weekday)
    // and the helper would spuriously promote a default-OPEN Saturday. The anchor prevents that.
    const { tx, calls } = makeFakeTx(null);
    await autoPromoteIfClosed(tx, new Date('2026-05-02T00:00:00Z'), 'admin-1', 'note');
    expect(calls.upsert).toHaveLength(0);
  });

  it('handles @db.Date midnight-UTC values: a stored Sunday is correctly NOT promoted', async () => {
    const { tx, calls } = makeFakeTx(null);
    await autoPromoteIfClosed(tx, new Date('2026-05-03T00:00:00Z'), 'admin-1', 'note');
    expect(calls.upsert).toHaveLength(0);
  });
});
