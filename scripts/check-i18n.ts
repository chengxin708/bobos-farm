#!/usr/bin/env tsx
/**
 * i18n parity checker.
 *
 * Asserts that messages/en.json and messages/zh.json have the SAME set of
 * leaf keys. Either side missing a key is treated as a build-breaking
 * error so a future copy change can't silently leave one locale stranded.
 *
 * Run: `npm run check:i18n` (also wired into prebuild as a guard).
 *
 * Background: commit f3ac5f4 fixed a bug where the admin cancel dialog
 * showed two "取消" buttons because en.json had a key that zh.json
 * lacked, so next-intl fell back to the key path. This script prevents
 * that class of regression.
 */
import fs from "node:fs";
import path from "node:path";

const EN_PATH = path.resolve(__dirname, "..", "messages", "en.json");
const ZH_PATH = path.resolve(__dirname, "..", "messages", "zh.json");

type JsonObj = { [k: string]: unknown };

function isObject(v: unknown): v is JsonObj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function flatten(obj: unknown, prefix = ""): Set<string> {
  const out = new Set<string>();
  if (!isObject(obj)) {
    out.add(prefix);
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (isObject(v)) {
      for (const child of flatten(v, next)) out.add(child);
    } else {
      out.add(next);
    }
  }
  return out;
}

function readJson(p: string): unknown {
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw);
}

function diff(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = [];
  for (const k of a) if (!b.has(k)) out.push(k);
  return out.sort();
}

function main() {
  const en = readJson(EN_PATH);
  const zh = readJson(ZH_PATH);
  const enKeys = flatten(en);
  const zhKeys = flatten(zh);

  const missingInZh = diff(enKeys, zhKeys);
  const missingInEn = diff(zhKeys, enKeys);

  if (missingInZh.length === 0 && missingInEn.length === 0) {
    console.log(
      `✓ i18n parity OK — ${enKeys.size} keys in both en.json and zh.json`,
    );
    return;
  }

  console.error("✗ i18n parity check failed.\n");
  if (missingInZh.length > 0) {
    console.error(
      `  Missing in messages/zh.json (${missingInZh.length}):`,
    );
    for (const k of missingInZh) console.error(`    - ${k}`);
    console.error("");
  }
  if (missingInEn.length > 0) {
    console.error(
      `  Missing in messages/en.json (${missingInEn.length}):`,
    );
    for (const k of missingInEn) console.error(`    - ${k}`);
    console.error("");
  }
  console.error(
    "Add the missing translations or remove the orphan keys, then rerun `npm run check:i18n`.",
  );
  process.exit(1);
}

main();
