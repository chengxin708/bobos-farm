/**
 * Parse appointment-data.xlsx and produce import-ready files.
 *
 * Outputs:
 *   - test-data/reservations-import-ready.json   (machine-readable, 119 rows)
 *   - test-data/reservations-import-ready.xlsx   (human-readable, 119 rows)
 *   - test-data/import-followup.xlsx             (10 red-flagged rows for customer follow-up)
 *
 * Run: npx tsx scripts/parse-and-stage-reservations.ts
 */
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const SRC = path.resolve(__dirname, "../../test-data/appointment-data.xlsx");
const OUT_JSON = path.resolve(__dirname, "../../test-data/reservations-import-ready.json");
const OUT_XLSX = path.resolve(__dirname, "../../test-data/reservations-import-ready.xlsx");
const OUT_FOLLOWUP = path.resolve(__dirname, "../../test-data/import-followup.xlsx");

const TODAY_TAG = "2026-04-16";

// ── Helpers ────────────────────────────────────────────────────────

function excelDateToISO(serial: number): string {
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const d = new Date(epoch.getTime() + serial * 86400000);
  return d.toISOString().split("T")[0];
}

function excelTimeFracToHHMM(frac: number): string {
  const totalMin = Math.round(frac * 24 * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseGuestCount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    if (raw > 1000) return null; // accidental Excel date serial
    return Math.round(raw);
  }
  const s = String(raw).trim();
  if (!s) return null;
  let m;
  if ((m = s.match(/(\d+)\s*大\s*(\d+)\s*小/))) return parseInt(m[1]) + parseInt(m[2]);
  if ((m = s.match(/^(\d+)\s+[#\d号]/))) return parseInt(m[1]);
  if ((m = s.match(/^(\d+)\s+#?\d/))) return parseInt(m[1]);
  if (/^\d\s*号/.test(s)) return null;
  if ((m = s.match(/around\s+(\d+)/i))) return parseInt(m[1]);
  if ((m = s.match(/(\d+)\s*(?:to|-)\s*(\d+)/))) return Math.round((parseInt(m[1]) + parseInt(m[2])) / 2);
  if ((m = s.match(/^(\d+)\s*up/i))) return parseInt(m[1]);
  if ((m = s.match(/^(\d+)/))) {
    const n = parseInt(m[1]);
    if (n > 0 && n <= 50) return n;
  }
  return null;
}

function parseYurtRequest(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  let m;
  if ((m = s.match(/(\d)\s*号\s*(?:包|bao)/i))) return "#" + m[1];
  if ((m = s.match(/#(\d)\s*bao/i))) return "#" + m[1];
  if ((m = s.match(/^(\d)\s*号/))) return "#" + m[1];
  return null;
}

function parsePhone(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const s = String(raw).trim();
  const m = s.match(/[\d\-\(\)\s]{10,}/);
  return m ? m[0].replace(/\s+/g, "").trim() : "";
}

function parseEmail(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const s = String(raw).trim();
  return s.includes("@") ? s : "";
}

function cleanName(raw: string): string {
  return raw
    .replace(/\s*微信\s*/g, "")
    .replace(/\s*Wechat\s*/gi, "")
    .replace(/\s*波电话\s*/g, "")
    .replace(/\s*\(paid by[^)]*\)/gi, "")
    .replace(/\s*\(contact[^)]*\)/gi, "")
    .replace(/\s*taid\b/gi, "")
    .trim();
}

function generatePlaceholderLocal(): string {
  // Identity-decoupled placeholder local-part. Format mirrors what /api/reservations/route.ts uses
  // for admin-created proxy bookings (see randomCuid there). Phone/wechat are NOT identifiers per
  // architecture decision — the placeholder is opaque until customer claims with their real email.
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 18);
  return `temp-${time}${rand}`;
}

// ── Note builder ───────────────────────────────────────────────────

interface NoteContext {
  rawName: string;
  cleanedName: string;
  rawCount: unknown;
  parsedCount: number;
  isCountEstimated: boolean;
  col1: unknown; // 时间/标签
  col4Raw: unknown; // 邮箱栏
  col4IsEmail: boolean;
  col6: unknown; // 付款人
  extraCols: string[]; // col[7..10]
  yurtReq: string | null;
}

function buildNote(ctx: NoteContext): string {
  const lines: string[] = [`导入自历史数据 (${TODAY_TAG})`];

  if (ctx.rawName !== ctx.cleanedName) {
    lines.push(`原始姓名: ${ctx.rawName}`);
  }

  // Special date/time from col[1]
  if (ctx.col1 !== null && ctx.col1 !== undefined && ctx.col1 !== "") {
    let t: string;
    if (typeof ctx.col1 === "number") t = excelTimeFracToHHMM(ctx.col1);
    else t = String(ctx.col1).trim();
    if (t) lines.push(`特殊日期/时间: ${t}`);
  }

  // Contact method from col[4] (when not an email)
  if (!ctx.col4IsEmail && ctx.col4Raw !== null && ctx.col4Raw !== undefined) {
    const v = String(ctx.col4Raw).trim();
    if (v) {
      if (v === "微信" || v === "Wechat") lines.push("联系方式: 微信");
      else if (v === "Bobo Farm 群") lines.push("联系方式: Bobo 群");
      else if (v === "moved from 5/16/26") lines.push("备注: 从 5/16/26 改期");
      else if (v === "waiting for deposit") lines.push("付款状态: 等待定金 (历史)");
      else lines.push(`邮箱栏其他内容: ${v}`);
    }
  }

  // Yurt request hint (we don't assign — preserve as note)
  if (ctx.yurtReq) {
    lines.push(`客户指定包房: ${ctx.yurtReq}`);
  }

  // Guest count: if estimated, flag it; else if raw differs from parsed, note it
  if (ctx.isCountEstimated) {
    const rawStr = ctx.rawCount === null || ctx.rawCount === undefined ? "(空)" : String(ctx.rawCount);
    lines.push(`⚠️ 人数为估算值 (原始: "${rawStr}", 默认: ${ctx.parsedCount} 人)`);
  } else if (typeof ctx.rawCount === "string" && String(ctx.parsedCount) !== ctx.rawCount.trim()) {
    lines.push(`原始人数: "${ctx.rawCount}" → 解析为 ${ctx.parsedCount} 人`);
  }

  // Payment-payer notes from col[6]
  if (ctx.col6 !== null && ctx.col6 !== undefined && ctx.col6 !== "") {
    lines.push(`付款备注: ${String(ctx.col6).trim()}`);
  }

  // Extras from col[7..10]
  if (ctx.extraCols.length > 0) {
    lines.push(`其他字段: ${ctx.extraCols.join(" | ")}`);
  }

  return lines.join("\n");
}

// ── Main ───────────────────────────────────────────────────────────

interface ImportRecord {
  rowIndex: number;
  flag: "green" | "yellow";
  date: string;
  user: { name: string; email: string; phone: string };
  reservation: { guestCount: number; depositAmount: number };
  note: string;
}

interface FollowupRecord {
  rowIndex: number;
  date: string;
  rawName: string;
  cleanName: string;
  rawCount: string;
  parsedCount: number | null;
  yurtReq: string;
  email: string;
  phone: string;
  contactRaw: string;
  flagReason: string;
  suggestedQuestion: string;
}

function main() {
  const wb = XLSX.readFile(SRC);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });

  const importReady: ImportRecord[] = [];
  const followups: FollowupRecord[] = [];
  const seenSameDateName = new Map<string, number>();

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || !row[0]) continue;

    const dateSerial = row[0];
    if (typeof dateSerial !== "number") continue;
    const rawName = row[3];

    // Date present but no name in expected column. Skip blank calendar slots,
    // but flag rows that have content in OTHER columns (data is misaligned —
    // e.g. name landed in col[8] instead of col[3]).
    if (!rawName || typeof rawName !== "string" || !rawName.trim()) {
      const hasOtherContent = row.some((v, j) => j !== 0 && v !== null && v !== undefined && v !== "");
      if (hasOtherContent) {
        const dump = row
          .map((v, j) => v !== null && v !== undefined && v !== "" && j !== 0 ? `[${j}]=${JSON.stringify(v)}` : null)
          .filter((x): x is string => x !== null)
          .join(" ");
        followups.push({
          rowIndex: i + 1,
          date: excelDateToISO(dateSerial),
          rawName: "(姓名缺失)",
          cleanName: "",
          rawCount: "",
          parsedCount: null,
          yurtReq: "",
          email: "",
          phone: "",
          contactRaw: dump,
          flagReason: "姓名列(col[3])为空但其他列有内容 — 数据错位",
          suggestedQuestion: "原始 Excel 行数据错位，请人工核对该日预约信息",
        });
      }
      continue;
    }

    const date = excelDateToISO(dateSerial);
    const rawNameStr = rawName.trim();
    const cleanedName = cleanName(rawNameStr);

    const rawCount = row[2];
    let parsedCount = parseGuestCount(rawCount);
    const yurtReq = parseYurtRequest(rawCount);

    let flag: "" | "yellow" | "red" = "";
    const flagReasons: string[] = [];
    let isCountEstimated = false;

    if (parsedCount === null) {
      flag = "yellow";
      flagReasons.push("人数缺失,已赋默认值");
      isCountEstimated = true;
      if (yurtReq === "#3") parsedCount = 12;
      else if (yurtReq === "#2") parsedCount = 20;
      else if (yurtReq === "#1") parsedCount = 25;
      else parsedCount = 15;
    }

    if (typeof rawCount === "number" && rawCount > 1000) {
      flag = "red";
      flagReasons.push(`原始值疑似Excel日期误粘贴: ${rawCount}`);
    }

    if (parsedCount > 28) {
      if (flag !== "red") flag = "red";
      flagReasons.push(`超过最大容量28,原始:${rawCount}`);
      parsedCount = 28;
    }

    // Same-date duplicate check
    const dupKey = `${date}|${rawNameStr}`;
    const dupCount = seenSameDateName.get(dupKey) ?? 0;
    seenSameDateName.set(dupKey, dupCount + 1);
    if (dupCount > 0) {
      flag = "red";
      flagReasons.push("同日期重复预订");
    }

    // Contact / extras
    const col1 = row[1];
    const col4 = row[4];
    const col5 = row[5];
    const col6 = row[6];
    const email = parseEmail(col4);
    const phone = parsePhone(col5) || parsePhone(col4);
    const col4IsEmail = email !== "";

    const extraCols: string[] = [];
    for (let c = 7; c <= 10; c++) {
      const v = row[c];
      if (v !== null && v !== undefined && v !== "") {
        extraCols.push(String(v).trim());
      }
    }

    if (flag === "red") {
      followups.push({
        rowIndex: i + 1,
        date,
        rawName: rawNameStr,
        cleanName: cleanedName,
        rawCount: rawCount === null || rawCount === undefined ? "" : String(rawCount),
        parsedCount,
        yurtReq: yurtReq ?? "",
        email,
        phone,
        contactRaw: col4 !== null && col4 !== undefined ? String(col4) : "",
        flagReason: flagReasons.join("; "),
        suggestedQuestion: deriveQuestion(flagReasons),
      });
      continue;
    }

    // Build note for green/yellow
    const note = buildNote({
      rawName: rawNameStr,
      cleanedName,
      rawCount,
      parsedCount,
      isCountEstimated,
      col1,
      col4Raw: col4,
      col4IsEmail,
      col6,
      extraCols,
      yurtReq,
    });

    const finalEmail = email || `${generatePlaceholderLocal()}@placeholder.local`;

    importReady.push({
      rowIndex: i + 1,
      flag: flag === "yellow" ? "yellow" : "green",
      date,
      user: { name: cleanedName, email: finalEmail, phone },
      reservation: { guestCount: parsedCount, depositAmount: 300 },
      note,
    });
  }

  writeJson(importReady);
  writeImportXlsx(importReady);
  writeFollowupXlsx(followups);

  const greenCount = importReady.filter(r => r.flag === "green").length;
  const yellowCount = importReady.filter(r => r.flag === "yellow").length;
  console.log("─── Output ───");
  console.log(`✅ green: ${greenCount}`);
  console.log(`⚠️ yellow: ${yellowCount}`);
  console.log(`❌ red (followup): ${followups.length}`);
  console.log(`Total: ${importReady.length + followups.length}`);
  console.log("");
  console.log("Files written:");
  console.log(`  ${OUT_JSON}`);
  console.log(`  ${OUT_XLSX}`);
  console.log(`  ${OUT_FOLLOWUP}`);
}

function deriveQuestion(reasons: string[]): string {
  const qs: string[] = [];
  for (const r of reasons) {
    if (r.includes("Excel日期误粘贴")) qs.push("人数栏看起来是误粘贴的日期，请确认实际人数");
    else if (r.includes("超过最大容量")) qs.push("人数超过包房最大容量(28)，请确认实际人数或拆成多个包");
    else if (r.includes("同日期重复")) qs.push("同一日同名出现多次，请确认是否为重复预订或不同客户");
  }
  return qs.length > 0 ? qs.join("; ") : "请人工核对";
}

function writeJson(records: ImportRecord[]) {
  fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), records }, null, 2), "utf8");
}

function writeImportXlsx(records: ImportRecord[]) {
  const header = ["源行号", "标记", "日期", "姓名", "邮箱", "电话", "人数", "定金", "预约 Note (导入后写入 ReservationNote)"];
  const aoa: unknown[][] = [header];
  for (const r of records) {
    aoa.push([
      r.rowIndex,
      r.flag === "yellow" ? "⚠️ 黄(估算人数)" : "✅ 绿",
      r.date,
      r.user.name,
      r.user.email,
      r.user.phone,
      r.reservation.guestCount,
      r.reservation.depositAmount,
      r.note,
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 8 }, { wch: 16 }, { wch: 12 }, { wch: 28 },
    { wch: 32 }, { wch: 18 }, { wch: 8 }, { wch: 8 }, { wch: 60 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "可导入预约");
  XLSX.writeFile(wb, OUT_XLSX);
}

function writeFollowupXlsx(records: FollowupRecord[]) {
  const header = [
    "源行号", "日期", "原始姓名", "清理后姓名",
    "原始人数", "解析后人数", "客户指定包房",
    "邮箱", "电话", "联系方式栏原值",
    "标记原因", "建议询问内容",
  ];
  const aoa: unknown[][] = [header];
  for (const r of records) {
    aoa.push([
      r.rowIndex, r.date, r.rawName, r.cleanName,
      r.rawCount, r.parsedCount ?? "", r.yurtReq,
      r.email, r.phone, r.contactRaw,
      r.flagReason, r.suggestedQuestion,
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 8 }, { wch: 12 }, { wch: 28 }, { wch: 24 },
    { wch: 14 }, { wch: 10 }, { wch: 10 },
    { wch: 30 }, { wch: 18 }, { wch: 18 },
    { wch: 40 }, { wch: 50 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "需向客户确认");
  XLSX.writeFile(wb, OUT_FOLLOWUP);
}

main();
