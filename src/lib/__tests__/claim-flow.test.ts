import { claimReservation } from "../claim-flow";

// ── Minimal in-memory fake Prisma client ──────────────────────────────
//
// Just enough surface for claimReservation to exercise its control flow.
// Writes go to mutable arrays. We intentionally model concurrency via an
// updateMany that atomically transitions token state — which is how the
// real token-consume check prevents double-claim.

interface FakeReservation {
  id: string;
  confirmationCode: string;
  userId: string;
  date: Date;
  guestCount: number;
  status: "PENDING_PAYMENT" | "PAYMENT_SUBMITTED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  yurtName: string | null;
}

interface FakeUser {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  wechatId: string | null;
  mergedIntoUserId: string | null;
}

interface FakeToken {
  id: string;
  reservationId: string;
  token: string;
  consumedAt: Date | null;
  consumedByUserId: string | null;
  revokedAt: Date | null;
  expiresAt: Date | null;
}

interface FakeContactEntry {
  userId: string;
  type: string;
  value: string;
  source: string;
  recordedById: string | null;
}

interface FakeInquiry {
  id: string;
  userId: string;
}

interface FakePushSub {
  id: string;
  userId: string;
}

interface FakeActivityLog {
  id: string;
  userId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
}

function makeFakeDb(init: {
  reservations?: FakeReservation[];
  users?: FakeUser[];
  tokens?: FakeToken[];
  contactEntries?: FakeContactEntry[];
  inquiries?: FakeInquiry[];
  pushSubs?: FakePushSub[];
} = {}) {
  const state = {
    reservations: init.reservations ?? [],
    users: init.users ?? [],
    tokens: init.tokens ?? [],
    contactEntries: init.contactEntries ?? [],
    inquiries: init.inquiries ?? [],
    pushSubs: init.pushSubs ?? [],
    activityLogs: [] as FakeActivityLog[],
  };
  let idCounter = 1000;
  const nextId = (prefix: string) => `${prefix}-${++idCounter}`;

  const matchToken = (where: Record<string, unknown>, t: FakeToken): boolean => {
    for (const [k, v] of Object.entries(where)) {
      if (k === "OR") continue;
      if (k === "consumedAt" && v === null && t.consumedAt !== null) return false;
      if (k === "revokedAt" && v === null && t.revokedAt !== null) return false;
      if (k === "token" && t.token !== v) return false;
      if (k === "reservationId" && t.reservationId !== v) return false;
    }
    const or = (where as { OR?: Array<Record<string, unknown>> }).OR;
    if (or) {
      const pass = or.some((c) => {
        if ("expiresAt" in c) {
          const ev = (c as { expiresAt: unknown }).expiresAt;
          if (ev === null) return t.expiresAt === null;
          if (typeof ev === "object" && ev && "gt" in (ev as Record<string, unknown>)) {
            const gt = (ev as { gt: Date }).gt;
            return t.expiresAt !== null && t.expiresAt > gt;
          }
        }
        return false;
      });
      if (!pass) return false;
    }
    return true;
  };

  const db = {
    reservation: {
      async findUnique({ where }: { where: { id?: string; confirmationCode?: string }; include?: unknown }) {
        const r = state.reservations.find((x) =>
          where.id ? x.id === where.id : x.confirmationCode === where.confirmationCode,
        );
        if (!r) return null;
        const user = state.users.find((u) => u.id === r.userId);
        return {
          ...r,
          user: user
            ? { id: user.id, email: user.email, name: user.name }
            : { id: r.userId, email: "missing@placeholder.local", name: null },
          yurt: r.yurtName ? { name: r.yurtName } : null,
        };
      },
      async findUniqueOrThrow(args: { where: { id?: string }; include?: unknown }) {
        const r = await db.reservation.findUnique(args);
        if (!r) throw new Error("not found");
        return r;
      },
      async findMany({ where }: { where: { userId?: string }; select?: unknown }) {
        return state.reservations
          .filter((r) => !where.userId || r.userId === where.userId)
          .map((r) => ({ id: r.id }));
      },
      async count({ where }: { where: { userId?: string; status?: { in?: string[] } } }) {
        return state.reservations.filter((r) => {
          if (where.userId && r.userId !== where.userId) return false;
          if (where.status?.in && !where.status.in.includes(r.status)) return false;
          return true;
        }).length;
      },
      async updateMany({ where, data }: { where: { userId?: string }; data: { userId?: string } }) {
        let count = 0;
        for (const r of state.reservations) {
          if (where.userId && r.userId !== where.userId) continue;
          if (data.userId) r.userId = data.userId;
          count++;
        }
        return { count };
      },
    },
    reservationClaimToken: {
      async findFirst({ where }: { where: Record<string, unknown>; select?: unknown }) {
        const active = state.tokens.filter((t) => matchToken(where, t));
        return active[0] ? { id: active[0].id } : null;
      },
      async updateMany({ where, data }: { where: Record<string, unknown>; data: Partial<FakeToken> }) {
        const targets = state.tokens.filter((t) => matchToken(where, t));
        for (const t of targets) Object.assign(t, data);
        return { count: targets.length };
      },
    },
    inquiry: {
      async findMany({ where }: { where: { userId?: string; id?: { in?: string[] } } }) {
        return state.inquiries
          .filter((i) => (!where.userId || i.userId === where.userId) && (!where.id?.in || where.id.in.includes(i.id)))
          .map((i) => ({ id: i.id }));
      },
      async updateMany({ where, data }: { where: { id?: { in?: string[] } }; data: { userId?: string } }) {
        let count = 0;
        for (const i of state.inquiries) {
          if (where.id?.in && !where.id.in.includes(i.id)) continue;
          if (data.userId) i.userId = data.userId;
          count++;
        }
        return { count };
      },
    },
    userContactEntry: {
      async findMany({ where }: { where: { userId: string } }) {
        return state.contactEntries.filter((e) => e.userId === where.userId);
      },
      async upsert({ where, create }: {
        where: { userId_type_value: { userId: string; type: string; value: string } };
        update: Record<string, unknown>;
        create: FakeContactEntry;
      }) {
        const key = where.userId_type_value;
        const existing = state.contactEntries.find(
          (e) => e.userId === key.userId && e.type === key.type && e.value === key.value,
        );
        if (existing) return existing;
        state.contactEntries.push(create);
        return create;
      },
      async deleteMany({ where }: { where: { userId: string } }) {
        const before = state.contactEntries.length;
        state.contactEntries = state.contactEntries.filter((e) => e.userId !== where.userId);
        return { count: before - state.contactEntries.length };
      },
    },
    pushSubscription: {
      async deleteMany({ where }: { where: { userId: string } }) {
        const before = state.pushSubs.length;
        state.pushSubs = state.pushSubs.filter((s) => s.userId !== where.userId);
        return { count: before - state.pushSubs.length };
      },
    },
    user: {
      async update({ where, data }: { where: { id: string }; data: Partial<FakeUser> }) {
        const u = state.users.find((x) => x.id === where.id);
        if (!u) throw new Error("user missing");
        Object.assign(u, data);
        return u;
      },
    },
    activityLog: {
      async create({ data }: { data: Omit<FakeActivityLog, "id"> }) {
        const row: FakeActivityLog = { id: nextId("log"), ...data };
        state.activityLogs.push(row);
        return row;
      },
    },
    async $transaction<T>(
      cb: (tx: unknown) => Promise<T>,
      _opts?: { isolationLevel?: string },
    ): Promise<T> {
      return cb(db);
    },
  };

  return { state, db };
}

// ── Scenarios ─────────────────────────────────────────────────────────

function baseFixture() {
  const placeholder: FakeUser = {
    id: "user-placeholder",
    email: "temp-abc@placeholder.local",
    name: "Guest Name",
    phone: "415-555-0100",
    wechatId: null,
    mergedIntoUserId: null,
  };
  const real: FakeUser = {
    id: "user-real",
    email: "real@example.com",
    name: "Real Person",
    phone: null,
    wechatId: null,
    mergedIntoUserId: null,
  };
  const reservation: FakeReservation = {
    id: "res-1",
    confirmationCode: "ABC123",
    userId: placeholder.id,
    date: new Date("2026-06-15"),
    guestCount: 8,
    status: "PENDING_PAYMENT",
    yurtName: "Yurt 1",
  };
  const token: FakeToken = {
    id: "tok-1",
    reservationId: reservation.id,
    token: "validtoken",
    consumedAt: null,
    consumedByUserId: null,
    revokedAt: null,
    expiresAt: null,
  };
  const contactEntries: FakeContactEntry[] = [
    { userId: placeholder.id, type: "phone", value: "415-555-0100", source: "admin", recordedById: null },
  ];
  return makeFakeDb({
    reservations: [reservation],
    users: [placeholder, real],
    tokens: [token],
    contactEntries,
  });
}

describe("claimReservation", () => {
  it("rejects admin sessions up-front", async () => {
    const { db } = baseFixture();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await claimReservation(db as any, {
      userId: "user-real",
      isAdmin: true,
      code: "ABC123",
      token: "validtoken",
    });
    expect(result).toEqual({ ok: false, error: "ADMIN_CANNOT_CLAIM" });
  });

  it("returns NOT_FOUND for an unknown confirmation code", async () => {
    const { db } = baseFixture();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await claimReservation(db as any, {
      userId: "user-real",
      isAdmin: false,
      code: "ZZZZZZ",
    });
    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("short-circuits when the session user already owns the reservation", async () => {
    const { db, state } = baseFixture();
    state.reservations[0].userId = "user-real"; // already claimed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await claimReservation(db as any, {
      userId: "user-real",
      isAdmin: false,
      code: "ABC123",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alreadyOwned).toBe(true);
      expect(result.mergedReservationIds).toEqual([]);
    }
  });

  it("returns ALREADY_CLAIMED when another real account owns it", async () => {
    const { db, state } = baseFixture();
    state.reservations[0].userId = "user-other";
    state.users.push({
      id: "user-other",
      email: "someone@example.com",
      name: null,
      phone: null,
      wechatId: null,
      mergedIntoUserId: null,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await claimReservation(db as any, {
      userId: "user-real",
      isAdmin: false,
      code: "ABC123",
      token: "validtoken",
    });
    expect(result).toEqual({ ok: false, error: "ALREADY_CLAIMED" });
  });

  it("rejects a CANCELLED reservation with STATUS_NOT_CLAIMABLE", async () => {
    const { db, state } = baseFixture();
    state.reservations[0].status = "CANCELLED";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await claimReservation(db as any, {
      userId: "user-real",
      isAdmin: false,
      code: "ABC123",
      token: "validtoken",
    });
    expect(result).toEqual({ ok: false, error: "STATUS_NOT_CLAIMABLE" });
  });

  it("rejects a wrong token with INVALID_TOKEN", async () => {
    const { db } = baseFixture();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await claimReservation(db as any, {
      userId: "user-real",
      isAdmin: false,
      code: "ABC123",
      token: "nope",
    });
    expect(result).toEqual({ ok: false, error: "INVALID_TOKEN" });
  });

  it("rejects a revoked token", async () => {
    const { db, state } = baseFixture();
    state.tokens[0].revokedAt = new Date();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await claimReservation(db as any, {
      userId: "user-real",
      isAdmin: false,
      code: "ABC123",
      token: "validtoken",
    });
    expect(result).toEqual({ ok: false, error: "INVALID_TOKEN" });
  });

  it("rejects an expired token", async () => {
    const { db, state } = baseFixture();
    state.tokens[0].expiresAt = new Date(Date.now() - 60_000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await claimReservation(db as any, {
      userId: "user-real",
      isAdmin: false,
      code: "ABC123",
      token: "validtoken",
    });
    expect(result).toEqual({ ok: false, error: "INVALID_TOKEN" });
  });

  it("takes the weak path and succeeds when placeholder has exactly 1 active reservation", async () => {
    const { db, state } = baseFixture();
    state.tokens = []; // no token in the URL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await claimReservation(db as any, {
      userId: "user-real",
      isAdmin: false,
      code: "ABC123",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mergedReservationIds).toContain("res-1");
      expect(state.users.find((u) => u.id === "user-placeholder")?.mergedIntoUserId).toBe("user-real");
    }
  });

  it("returns AMBIGUOUS when placeholder has multiple active reservations and no token", async () => {
    const { db, state } = baseFixture();
    state.tokens = [];
    state.reservations.push({
      id: "res-2",
      confirmationCode: "DEF456",
      userId: "user-placeholder",
      date: new Date("2026-07-20"),
      guestCount: 5,
      status: "CONFIRMED",
      yurtName: "Yurt 2",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await claimReservation(db as any, {
      userId: "user-real",
      isAdmin: false,
      code: "ABC123",
    });
    expect(result).toEqual({ ok: false, error: "AMBIGUOUS" });
  });

  it("migrates ALL placeholder reservations (incl. past ones) on a successful claim", async () => {
    const { db, state } = baseFixture();
    state.reservations.push({
      id: "res-old",
      confirmationCode: "OLD111",
      userId: "user-placeholder",
      date: new Date("2025-01-01"),
      guestCount: 4,
      status: "COMPLETED",
      yurtName: "Yurt Old",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await claimReservation(db as any, {
      userId: "user-real",
      isAdmin: false,
      code: "ABC123",
      token: "validtoken",
    });
    expect(result.ok).toBe(true);
    const ownedByReal = state.reservations.filter((r) => r.userId === "user-real").map((r) => r.id);
    expect(ownedByReal).toEqual(expect.arrayContaining(["res-1", "res-old"]));
  });

  it("consumes the token (so a second claim attempt returns INVALID_TOKEN)", async () => {
    const { db } = baseFixture();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = await claimReservation(db as any, {
      userId: "user-real",
      isAdmin: false,
      code: "ABC123",
      token: "validtoken",
    });
    expect(first.ok).toBe(true);

    // A second attacker tries the same token — the placeholder has been
    // merged away so the reservation is now owned by user-real, i.e.
    // ALREADY_CLAIMED. This also guards against the attacker replaying
    // the token against any *other* placeholder.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const second = await claimReservation(db as any, {
      userId: "user-attacker",
      isAdmin: false,
      code: "ABC123",
      token: "validtoken",
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(["ALREADY_CLAIMED", "INVALID_TOKEN"]).toContain(second.error);
    }
  });

  it("writes an ACCOUNT_MERGED activity log with the placeholder email and merged ids", async () => {
    const { db, state } = baseFixture();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await claimReservation(db as any, {
      userId: "user-real",
      isAdmin: false,
      code: "ABC123",
      token: "validtoken",
    });
    const merged = state.activityLogs.find((l) => l.action === "ACCOUNT_MERGED");
    expect(merged).toBeDefined();
    expect(merged?.targetId).toBe("user-placeholder");
    expect(merged?.details?.placeholderEmail).toBe("temp-abc@placeholder.local");
    expect(merged?.details?.mergedReservationIds).toContain("res-1");
  });

  // Concurrent-claim guard — two parallel attackers race for the same
  // single-use token. The contract relies on `updateMany({where: {token,
  // consumedAt: null}})` being atomic: only the first call matches a
  // row, the second matches zero. Even though Jest runs single-threaded,
  // Promise.all forces both branches to traverse the full pipeline before
  // either commits, which is the case the production DB constraint must
  // catch. Exactly one claim must win.
  it("concurrent claims with the same token: exactly one wins", async () => {
    const { db, state } = baseFixture();
    // Add a second real account to play the role of the second claimant.
    state.users.push({
      id: "user-second",
      email: "second@example.com",
      name: null,
      phone: null,
      wechatId: null,
      mergedIntoUserId: null,
    });

    const [a, b] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      claimReservation(db as any, {
        userId: "user-real",
        isAdmin: false,
        code: "ABC123",
        token: "validtoken",
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      claimReservation(db as any, {
        userId: "user-second",
        isAdmin: false,
        code: "ABC123",
        token: "validtoken",
      }),
    ]);

    const successes = [a, b].filter((r) => r.ok);
    const failures = [a, b].filter((r) => !r.ok);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    // The reservation should now belong to the winner, never both.
    const reservation = state.reservations.find((r) => r.id === "res-1");
    expect(["user-real", "user-second"]).toContain(reservation?.userId);

    // Token must be consumed exactly once.
    const token = state.tokens.find((t) => t.token === "validtoken");
    expect(token?.consumedAt).not.toBeNull();
  });

  // Replay attack — once the token is consumed, every later claim must
  // fail (INVALID_TOKEN or ALREADY_CLAIMED depending on whether the
  // placeholder has been merged). No path leads to a stolen reservation.
  it("post-consume replay attempts always fail", async () => {
    const { db, state } = baseFixture();
    // First valid claim consumes the token.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = await claimReservation(db as any, {
      userId: "user-real",
      isAdmin: false,
      code: "ABC123",
      token: "validtoken",
    });
    expect(first.ok).toBe(true);

    // Spawn three more attackers in parallel.
    state.users.push(
      { id: "atk-1", email: "a1@x.com", name: null, phone: null, wechatId: null, mergedIntoUserId: null },
      { id: "atk-2", email: "a2@x.com", name: null, phone: null, wechatId: null, mergedIntoUserId: null },
      { id: "atk-3", email: "a3@x.com", name: null, phone: null, wechatId: null, mergedIntoUserId: null },
    );

    const replays = await Promise.all(
      ["atk-1", "atk-2", "atk-3"].map((uid) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        claimReservation(db as any, {
          userId: uid,
          isAdmin: false,
          code: "ABC123",
          token: "validtoken",
        }),
      ),
    );
    for (const r of replays) {
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(["ALREADY_CLAIMED", "INVALID_TOKEN"]).toContain(r.error);
      }
    }
    // Reservation still owned by the original winner, not any attacker.
    const reservation = state.reservations.find((r) => r.id === "res-1");
    expect(["atk-1", "atk-2", "atk-3"]).not.toContain(reservation?.userId);
  });
});
