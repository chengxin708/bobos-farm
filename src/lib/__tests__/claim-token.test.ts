import { generateClaimToken, createClaimToken, getActiveClaimToken } from "../claim-token";

describe("generateClaimToken", () => {
  it("emits a url-safe 43-char string (base64url of 32 bytes)", () => {
    const token = generateClaimToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("produces unique values across many draws", () => {
    const set = new Set<string>();
    for (let i = 0; i < 200; i++) set.add(generateClaimToken());
    expect(set.size).toBe(200);
  });
});

type TokenRow = {
  id: string;
  reservationId: string;
  token: string;
  createdAt: Date;
  expiresAt: Date | null;
  consumedAt: Date | null;
  consumedByUserId: string | null;
  revokedAt: Date | null;
};

// Tiny in-memory stand-in for the prisma client so we can exercise the
// createClaimToken / getActiveClaimToken control flow without a DB.
function makeFakeDb(initial: TokenRow[] = []) {
  const rows: TokenRow[] = [...initial];
  let counter = 0;
  return {
    rows,
    reservationClaimToken: {
      async updateMany({ where, data }: { where: Partial<TokenRow>; data: Partial<TokenRow> }) {
        let count = 0;
        for (const r of rows) {
          if (where.reservationId && r.reservationId !== where.reservationId) continue;
          if ("consumedAt" in where && r.consumedAt !== where.consumedAt) continue;
          if ("revokedAt" in where && r.revokedAt !== where.revokedAt) continue;
          Object.assign(r, data);
          count++;
        }
        return { count };
      },
      async create({ data }: { data: Partial<TokenRow> }) {
        const row: TokenRow = {
          id: `t${++counter}`,
          reservationId: data.reservationId!,
          token: data.token!,
          createdAt: new Date(),
          expiresAt: data.expiresAt ?? null,
          consumedAt: null,
          consumedByUserId: null,
          revokedAt: null,
        };
        rows.push(row);
        return { id: row.id, token: row.token, expiresAt: row.expiresAt };
      },
      async findFirst({ where, orderBy: _orderBy }: {
        where: {
          reservationId?: string;
          consumedAt?: null;
          revokedAt?: null;
          OR?: Array<{ expiresAt: null } | { expiresAt: { gt: Date } }>;
        };
        orderBy?: unknown;
      }) {
        const now = new Date();
        const matches = rows.filter((r) => {
          if (where.reservationId && r.reservationId !== where.reservationId) return false;
          if (where.consumedAt === null && r.consumedAt !== null) return false;
          if (where.revokedAt === null && r.revokedAt !== null) return false;
          if (where.OR) {
            const ok = where.OR.some((c) => {
              if ("expiresAt" in c && c.expiresAt === null) return r.expiresAt === null;
              if ("expiresAt" in c && typeof c.expiresAt === "object" && c.expiresAt && "gt" in c.expiresAt) {
                return r.expiresAt !== null && r.expiresAt > c.expiresAt.gt;
              }
              return false;
            });
            if (!ok) return false;
          }
          return true;
        });
        const latest = matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
        return latest
          ? { id: latest.id, token: latest.token, expiresAt: latest.expiresAt }
          : null;
      },
    },
  };
}

describe("createClaimToken", () => {
  it("revokes any prior active token on the same reservation", async () => {
    const db = makeFakeDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbAny = db as any;

    const first = await createClaimToken(dbAny, "res-1");
    const second = await createClaimToken(dbAny, "res-1");

    expect(second.token).not.toBe(first.token);

    const firstRow = db.rows.find((r) => r.id === first.id)!;
    const secondRow = db.rows.find((r) => r.id === second.id)!;
    expect(firstRow.revokedAt).not.toBeNull();
    expect(secondRow.revokedAt).toBeNull();
  });

  it("honors a provided expiresAt", async () => {
    const db = makeFakeDb();
    const expires = new Date(Date.now() + 86400_000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const issued = await createClaimToken(db as any, "res-x", { expiresAt: expires });
    expect(issued.expiresAt).toEqual(expires);
  });
});

describe("getActiveClaimToken", () => {
  it("returns null when no tokens exist", async () => {
    const db = makeFakeDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const found = await getActiveClaimToken(db as any, "res-empty");
    expect(found).toBeNull();
  });

  it("skips revoked tokens and returns the active one", async () => {
    const db = makeFakeDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbAny = db as any;
    await createClaimToken(dbAny, "res-2");
    const latest = await createClaimToken(dbAny, "res-2");

    const found = await getActiveClaimToken(dbAny, "res-2");
    expect(found?.token).toBe(latest.token);
  });
});
