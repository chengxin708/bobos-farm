import { classifyBillPath, isBillHost } from "../middleware";

describe("isBillHost", () => {
  it("matches production host", () => {
    expect(isBillHost("bill.bobosfarm.com")).toBe(true);
  });
  it("matches localhost variants", () => {
    expect(isBillHost("bill.localhost:3000")).toBe(true);
    expect(isBillHost("bill.localhost")).toBe(true);
  });
  it("does not match main host", () => {
    expect(isBillHost("bobosfarm.com")).toBe(false);
    expect(isBillHost("www.bobosfarm.com")).toBe(false);
    expect(isBillHost("")).toBe(false);
  });
});

describe("classifyBillPath", () => {
  it("public paths bypass auth", () => {
    expect(classifyBillPath("/")).toEqual({ kind: "public", rewriteTo: "/_bill" });
    expect(classifyBillPath("/api/bill/auth")).toEqual({ kind: "public" });
    expect(classifyBillPath("/r/abc123")).toEqual({ kind: "public" });
  });

  it("authed paths require session and rewrite to /_bill prefix", () => {
    expect(classifyBillPath("/list")).toEqual({ kind: "authed", rewriteTo: "/_bill/list" });
    expect(classifyBillPath("/new")).toEqual({ kind: "authed", rewriteTo: "/_bill/new" });
    expect(classifyBillPath("/edit/abc")).toEqual({ kind: "authed", rewriteTo: "/_bill/edit/abc" });
  });

  it("api/bill/receipts paths are authed without rewrite", () => {
    expect(classifyBillPath("/api/bill/receipts")).toEqual({ kind: "authed" });
    expect(classifyBillPath("/api/bill/receipts/abc")).toEqual({ kind: "authed" });
  });

  it("internal _bill prefix is forbidden", () => {
    expect(classifyBillPath("/_bill")).toEqual({ kind: "forbidden" });
    expect(classifyBillPath("/_bill/list")).toEqual({ kind: "forbidden" });
  });

  it("unknown paths are forbidden", () => {
    expect(classifyBillPath("/admin")).toEqual({ kind: "forbidden" });
    expect(classifyBillPath("/menu")).toEqual({ kind: "forbidden" });
  });
});
