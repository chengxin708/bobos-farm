import { formatDeadline } from "../format-deadline";

describe("formatDeadline", () => {
  const now = new Date("2026-04-20T12:00:00Z");

  it("marks past deadlines as overdue with absolute lateness", () => {
    const r = formatDeadline(new Date("2026-04-20T00:00:00Z"), now);
    expect(r.status).toBe("overdue");
    expect(r.overdue).toBe(true);
    expect(r.hours).toBe(12);
  });

  it("uses dueSoonMinutes under 1h", () => {
    const r = formatDeadline(new Date("2026-04-20T12:30:00Z"), now);
    expect(r.status).toBe("dueSoonMinutes");
    expect(r.overdue).toBe(false);
    expect(r.minutes).toBe(30);
  });

  it("uses dueSoonHours between 1h and 24h", () => {
    const r = formatDeadline(new Date("2026-04-20T18:00:00Z"), now);
    expect(r.status).toBe("dueSoonHours");
    expect(r.hours).toBe(6);
  });

  it("uses normal past 24h", () => {
    const r = formatDeadline(new Date("2026-04-22T12:00:00Z"), now);
    expect(r.status).toBe("normal");
    expect(r.hours).toBe(48);
  });

  it("accepts string deadlines", () => {
    const r = formatDeadline("2026-04-21T12:00:00Z", now);
    expect(r.hours).toBe(24);
    expect(r.status).toBe("normal");
  });
});
