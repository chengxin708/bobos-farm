const XLSX = require("xlsx");

function excelDateToJS(serial) {
  const epoch = new Date(1899, 11, 30);
  const d = new Date(epoch.getTime() + serial * 86400000);
  return d.toISOString().split("T")[0];
}

function parseGuestCount(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    if (raw > 1000) return null;
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
  if ((m = s.match(/^(\d+)/))) { const n = parseInt(m[1]); if (n > 0 && n <= 50) return n; }
  return null;
}

function parseYurtRequest(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  let m;
  if ((m = s.match(/(\d)\s*号\s*(?:包|bao)/i))) return "#" + m[1];
  if ((m = s.match(/#(\d)\s*bao/i))) return "#" + m[1];
  if ((m = s.match(/^(\d)\s*号/))) return "#" + m[1];
  return null;
}

function parsePhone(raw) {
  if (raw === null || raw === undefined) return "";
  const s = String(raw).trim();
  const m = s.match(/[\d\-\(\)\s]{10,}/);
  return m ? m[0].replace(/\s+/g, "").trim() : "";
}

function parseEmail(raw) {
  if (raw === null || raw === undefined) return "";
  const s = String(raw).trim();
  if (s.includes("@")) return s;
  return "";
}

// ── Read source ──
const wb = XLSX.readFile("../test-data/appointment-data.xlsx");
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
const dataRows = rows.slice(2).filter((r) => r.length > 0 && r[0]);

const parsed = [];

for (const row of dataRows) {
  const dateSerial = row[0];
  if (!dateSerial || typeof dateSerial !== "number") continue;
  const name = row[3];
  if (!name || typeof name !== "string" || !name.trim()) continue;

  const date = excelDateToJS(dateSerial);
  const rawCount = row[2];
  let guestCount = parseGuestCount(rawCount);
  const yurtReq = parseYurtRequest(rawCount);

  let flag = "";
  const flagReasons = [];

  if (guestCount === null) {
    flag = "yellow";
    flagReasons.push("人数缺失,已赋默认值");
    if (yurtReq === "#3") guestCount = 12;
    else if (yurtReq === "#2") guestCount = 20;
    else if (yurtReq === "#1") guestCount = 25;
    else guestCount = 15;
  }

  if (typeof rawCount === "number" && rawCount > 1000) {
    flag = "red";
    flagReasons.push("原始值疑似Excel日期误粘贴: " + rawCount);
  }

  if (guestCount > 28) {
    if (!flag) flag = "red";
    flagReasons.push("超过最大容量28,原始:" + rawCount);
    guestCount = 28;
  }

  // Duplicate check
  const dupes = parsed.filter((p) => p.date === date && p.rawName === name.trim());
  if (dupes.length > 0) {
    flag = "red";
    flagReasons.push("同日期重复预订");
  }

  const emailCol = row[4];
  const phoneCol = row[5];
  const email = parseEmail(emailCol);
  const phone = parsePhone(phoneCol) || parsePhone(emailCol);
  const contactMethod =
    emailCol === "微信" || emailCol === "Wechat" ? "WeChat" :
    emailCol === "Bobo Farm 群" ? "Bobo群" : "";

  const cleanName = name
    .replace(/\s*微信\s*/g, "")
    .replace(/\s*Wechat\s*/gi, "")
    .replace(/\s*波电话\s*/g, "")
    .replace(/\s*\(paid by.*\)/gi, "")
    .replace(/\s*\(contact.*\)/gi, "")
    .replace(/\s*taid\b/gi, "")
    .trim();

  const notes = [];
  if (row[1] && typeof row[1] === "string") notes.push(row[1]);
  if (row[6] && typeof row[6] === "string") notes.push(row[6]);
  if (emailCol === "moved from 5/16/26") notes.push("从5/16改期");

  parsed.push({
    date,
    rawName: name.trim(),
    cleanName,
    guestCount,
    rawCount: rawCount != null ? String(rawCount) : "",
    yurtReq: yurtReq || "",
    email,
    phone,
    contactMethod,
    notes: notes.join("; "),
    flag,
    flagReasons: flagReasons.join("; "),
  });
}

// ── Sheet 1: 解析结果(全部) with colors ──
const header = ["日期", "姓名", "解析人数", "原始人数", "指定包房", "邮箱", "电话", "联系方式", "备注", "标记", "标记原因"];
const allData = [header];
for (const r of parsed) {
  allData.push([
    r.date, r.cleanName, r.guestCount, r.rawCount, r.yurtReq,
    r.email, r.phone, r.contactMethod, r.notes,
    r.flag === "yellow" ? "⚠️ 缺人数" : r.flag === "red" ? "❌ 待确认" : "✅ 可导入",
    r.flagReasons,
  ]);
}

const wsAll = XLSX.utils.aoa_to_sheet(allData);
wsAll["!cols"] = [
  { wch: 12 }, { wch: 28 }, { wch: 10 }, { wch: 20 }, { wch: 10 },
  { wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 30 }, { wch: 12 }, { wch: 45 },
];

// Apply background colors
for (let i = 1; i < allData.length; i++) {
  const flag = parsed[i - 1].flag;
  if (!flag) continue;
  const color = flag === "yellow" ? "FFFFFF00" : "FFFF6666";
  for (let c = 0; c < header.length; c++) {
    const ref = XLSX.utils.encode_cell({ r: i, c });
    if (wsAll[ref]) {
      if (!wsAll[ref].s) wsAll[ref].s = {};
      wsAll[ref].s = { fill: { patternType: "solid", fgColor: { rgb: color } } };
    }
  }
}

// ── Sheet 2: 可导入数据 ──
const importHeader = ["日期", "姓名", "人数", "指定包房", "邮箱", "电话", "联系方式", "备注"];
const importData = [importHeader];
const ready = parsed.filter((r) => r.flag === "");
for (const r of ready) {
  importData.push([r.date, r.cleanName, r.guestCount, r.yurtReq, r.email, r.phone, r.contactMethod, r.notes]);
}
const wsImport = XLSX.utils.aoa_to_sheet(importData);
wsImport["!cols"] = [
  { wch: 12 }, { wch: 28 }, { wch: 8 }, { wch: 10 },
  { wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 30 },
];

// ── Write output ──
const wbOut = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbOut, wsAll, "解析结果(全部)");
XLSX.utils.book_append_sheet(wbOut, wsImport, "可导入数据");

// Use xlsx-style compatible write for colors (xlsb format doesn't support styles in basic xlsx)
// For maximum compatibility, write as xlsx
XLSX.writeFile(wbOut, "../test-data/appointment-data-parsed.xlsx", { bookSST: true });

// ── Print summary ──
const yellowCount = parsed.filter((r) => r.flag === "yellow").length;
const redCount = parsed.filter((r) => r.flag === "red").length;
const greenCount = parsed.filter((r) => r.flag === "").length;

console.log("输出: test-data/appointment-data-parsed.xlsx");
console.log("");
console.log("统计:");
console.log("  ✅ 可导入: " + greenCount + " 条");
console.log("  ⚠️ 缺人数(黄): " + yellowCount + " 条");
console.log("  ❌ 待确认(红): " + redCount + " 条");
console.log("  总计: " + parsed.length + " 条");
console.log("");

console.log("── ⚠️ 黄色(缺人数,已赋默认值) ──");
parsed.filter((r) => r.flag === "yellow").forEach((r) => {
  console.log("  " + r.date + " | " + r.cleanName + " → 默认" + r.guestCount + "人" + (r.yurtReq ? " (指定" + r.yurtReq + ")" : ""));
});

console.log("");
console.log("── ❌ 红色(待确认) ──");
parsed.filter((r) => r.flag === "red").forEach((r) => {
  console.log("  " + r.date + " | " + r.cleanName + " | 解析:" + r.guestCount + "人 | " + r.flagReasons);
});
