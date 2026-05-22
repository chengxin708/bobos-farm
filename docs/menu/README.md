# Bo Farm Menu — Source Files

## Canonical source
**`prisma/seed.ts`** is the authoritative menu (5 categories, 34 dishes).
Edits should go there. To sync the DB after editing:

```bash
npx tsx --env-file=.env.local prisma/seed.ts
```

This wipes `menu_items` + `menu_categories` and recreates them from the seed.
Safe because the Bill subdomain's `QuickReceiptItem` snapshots names+prices
at receipt-creation time — historical receipts are unaffected by menu deletes.

## Reference copies (here)

- **`Bo Farm Menu.docx`** — original Word document the menu was recovered from
  (Northeast Chinese / Dongbei style; 5 categories; bilingual EN+ZH).
- **`Bo_Farm_Menu.txt`** — plain-text extraction of the same content (for grep + diff).

These are kept as a paper trail in case the seed file is ever lost or someone
needs the original source format. They do NOT auto-sync to the database — only
`prisma/seed.ts` does.

## Image storage

3 dish photos live in Supabase storage bucket `menu-images/menu/`:

- `roast-whole-lamb.webp` → 烤全羊
- `goose-stew.webp` → 铁锅炖大鹅
- `fish-stew-demoli.webp` → 铁锅德莫利炖鱼

Add more via `scripts/upload-dish.ts`:

```bash
npx tsx scripts/upload-dish.ts <local-image-path> "<English dish name>" <storage-name>
```

Then add the storage name to the corresponding item in `seed.ts` so it survives
a re-seed.

## History
Recovered 2026-05-21 from Bo Farm Menu.docx after a Supabase schema reset wiped
manually-added menu items. See commits `9f1583a` (seed.ts replacement).
