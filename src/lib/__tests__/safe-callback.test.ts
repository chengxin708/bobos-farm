import { safeCallbackUrl, DEFAULT_CALLBACK } from "../safe-callback";

const ORIGIN = "https://bobos.farm";

describe("safeCallbackUrl", () => {
  it("returns the default when input is null/empty", () => {
    expect(safeCallbackUrl(null, ORIGIN)).toBe(DEFAULT_CALLBACK);
    expect(safeCallbackUrl(undefined, ORIGIN)).toBe(DEFAULT_CALLBACK);
    expect(safeCallbackUrl("", ORIGIN)).toBe(DEFAULT_CALLBACK);
  });

  it("accepts allowlisted relative paths", () => {
    expect(safeCallbackUrl("/booking/start", ORIGIN)).toBe("/booking/start");
    expect(safeCallbackUrl("/claim", ORIGIN)).toBe("/claim");
    expect(safeCallbackUrl("/reservations/abc123", ORIGIN)).toBe("/reservations/abc123");
    expect(safeCallbackUrl("/inquiries/new", ORIGIN)).toBe("/inquiries/new");
  });

  it("preserves the query string on allowlisted paths", () => {
    expect(safeCallbackUrl("/claim?code=ABC&t=xyz", ORIGIN)).toBe("/claim?code=ABC&t=xyz");
  });

  it("rejects off-origin absolute URLs", () => {
    expect(safeCallbackUrl("https://evil.example.com/steal", ORIGIN)).toBe(DEFAULT_CALLBACK);
    expect(safeCallbackUrl("//evil.example.com/steal", ORIGIN)).toBe(DEFAULT_CALLBACK);
  });

  it("rejects non-allowlisted paths", () => {
    expect(safeCallbackUrl("/admin/settings", ORIGIN)).toBe(DEFAULT_CALLBACK);
    expect(safeCallbackUrl("/", ORIGIN)).toBe(DEFAULT_CALLBACK);
    expect(safeCallbackUrl("/api/reservations", ORIGIN)).toBe(DEFAULT_CALLBACK);
  });

  it("rejects lookalike prefixes (/bookingFOO should not match /booking)", () => {
    expect(safeCallbackUrl("/bookingFOO", ORIGIN)).toBe(DEFAULT_CALLBACK);
    expect(safeCallbackUrl("/claim-evil", ORIGIN)).toBe(DEFAULT_CALLBACK);
  });

  it("rejects malformed URLs", () => {
    expect(safeCallbackUrl("not a url", ORIGIN)).toBe(DEFAULT_CALLBACK);
  });
});
