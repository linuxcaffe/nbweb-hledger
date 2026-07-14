# NbWeb-hledger — CLAUDE.md

External nb-web plugin. One file: `nbweb-hledger.js`. Loaded via `nb-settings.json`. Dev-only verification tools live alongside it in `.tools/` (not shipped, `npm install` first — see "Testing" below).

## What it does
Domain knowledge layer on top of hledger: CoA wizard, Canadian tax mappings, chart codeblock, account/template/period/report/item note types, item cost/sale tracking. Not a data viewer — hledger does that. This is the opinionated layer.

## Key files
| Path | Role |
|------|------|
| `nbweb-hledger.js` | The plugin — all frontend code |
| `.tools/test-item-fields-modal.js` | jsdom DOM-level test for the item fields modal (not pytest, not Playwright — see "Testing") |
| `README.md` | User docs + chart block reference + implementation notes |
| `claude:nbweb-hledger_plugin_design.md` | Canonical design doc (CoA hierarchies, personas, build order, Sales pack, item annotation workflow) — authoritative, do not archive |

## chart codeblock invariants
- Revenue (`type:R`) is **negative** in hledger bal output — negate for cashflow income series
- `typeof NbNav !== 'undefined' ? NbNav.notebook : ''` — NbNav is `const` not on `window`
- Sequential `for...of` (not `Promise.all`) — Chart.js touches shared canvas state
- Doughnut: `aspectRatio: 1.5`

## Plugin registration
`NbWeb.registerModule('hledger', { detect, codeblockRenderers, previewRenderer, listDefaults, sortOptions, listItemIcon })`
`detect`: notebooks with a `hledger:` block in their `.{notebook}.md`. **Not** `.nb-hledger.json` — that anchor-file convention is what an earlier draft of this doc (and the design doc, until 2026-07-14) documented, but no notebook actually has one; `_hledger_config_for_notebook` (`app.py`) checks it first for legacy compat, then falls back to the `hledger:` block, which is what every real notebook (`djp:`, `accts:`, `pfinds:`) actually uses.

## Note types
`account`, `template`, `period`, `report`, `item` — icons 📒📋📅📊🏷️. `account`/`template`/`period`/`report` rendered by this plugin's own `previewRenderer`; `item` is different — see "Item type is special" below. `previewRenderer` must use `NbMain.renderMarkdown(body, selector)` not `marked.parse()`.

## Item type is special — registered elsewhere, actions here

`item` is the first type where the specialty-header registration and the money-tracking actions live in *different* plugins on purpose:

- **Type registration + header embedding**: `nbweb-quartz.js` (shop/item is its domain). Registers `item` with `NbSpecialty` lazily (script-load-order gotcha, see `docs:dev/dev-plugins.md`'s `NbSpecialty` section) and calls `NbSpecialty.renderHeader(note)` directly inside its own item-card renderer — `item` is deliberately excluded from `nbweb-specialty.js`'s own `previewRendererDetect`, so there's no second competing full-page specialty view to toggle to.
- **Actions**: this plugin (`nbweb-hledger.js`) extends the shared `NbSpecialty.getActions` for `item` — same money-tracking-actions convention as `invoice`/`quote`. Three buttons/behaviors:
  - **✅ Sold** — simple `status: sold` flip (`_itemMarkSold`), mirrors `_invoiceMarkPaid`. No sale details captured here; that's the annotation's job.
  - **📊 Summary** — `_itemSummary` parses `note.annotation` (already present on the fetched note object — zero extra request) for `​```ledger​```` blocks via `_extractLedgerTransactions`, computes bought/sold/fees/net from the acquired/sold transaction pair, shows a popup.
  - **📝 Fields** — `_itemFieldsModal`, the third of three ways to fill in an item's fields (full writeup: `docs:dev/dev-frontmatter-editor.md`). Fetches `/api/note/constraints-full` for the item's folder schema (`items/.items.md`), shows every declared field — required or optional, blank or not — using the same `NbWeb.fmUtils` helpers the Frontmatter/FM panel uses.
  - A `sold, no sale recorded` warning chip appears in the action bar when `status: sold` but no ledger transaction decreasing `Assets:Inventory` exists yet in the annotation — same detection logic `quartz-shop-item-missing.sh`-style checks would use, surfaced earlier/closer to the mistake.

## Item cost/sale tracking — annotation ledger blocks, cross-notebook aggregator

Central rule (house-wide, `.rules/hledger.md`): **`ledger` blocks only ever live in annotation sidecars, never note bodies.** For items specifically: `price` (the public asking price) stays in the item's own frontmatter, published as normal. `cost` and the `acquired`/`sold` transactions live only in `.{item}.md.annotations.md` — annotations are structurally invisible to the Quartz publish pipeline (dotfiles never match `globby()`'s default glob), so there's no leak path to get wrong, not just a convention to remember.

Two `sold` variants, chosen by the platform's own tax-collection policy (see the platform account note's `tax_collection.gst_hst` field, Sales pack design doc): platform-collects (no `Liabilities:HST` posting, tagged `tax:platform-collected` for return reporting) vs. seller-self-collects (normal HST split). The wizard doesn't need to know which — that's a per-transaction judgment call at posting time, not an account-generation decision.

**Aggregation is a separate script, not live**: `pfinds:.tools/gen-items-journal.py`, modeled directly on `Takeout:.tools/gen-timeclock.py` (same pattern: glob a folder's `.*.annotations.md` sidecars, extract one fenced-block type, write a generated journal). The one genuinely new wrinkle vs. that precedent: it's cross-notebook — items live in the *public* notebook (`preciousfinds.ca:items/`), the journal lives in the *private* one (`pfinds:accounting/`) — absolute path, same convention `.rules/hledger.md`'s "production notebooks... absolute paths" rule already uses elsewhere. Regeneration reuses the existing generic `/api/hledger/regen` endpoint; no new backend needed for that part.

## Audiences (priority order)
1. Personal finance — Canadian, TFSA/RRSP/FHSA, T1
2. Small business — HST by province, T2125
3. Sales / resale shop — named platform accounts, item cost/margin tracking, Canadian GST/HST/PST/QST (see Sales pack section of the design doc)
4. Production accounting — above/below the line, CPTC

## Testing

No pytest/Playwright coverage for this plugin's own JS — those live in the separate `nb-web-tests` repo and cover `app.py`/full-browser E2E, not one plugin's DOM logic in isolation. `.tools/test-item-fields-modal.js` fills that middle ground: loads this plugin's actual `nbweb-hledger.js` (and `nb-web`'s `nbweb-codeblocks.js` for the shared `fmUtils` helpers) into a real jsdom DOM via `eval()` of the stripped IIFE body, drives `_itemFieldsModal` against real fixture data, asserts on the resulting DOM and the PUT payload. `cd .tools && npm install && node test-item-fields-modal.js`. Worth extending this pattern (not pytest, not Playwright) for other DOM-heavy logic in this plugin that doesn't need a real running server/browser to verify.

The backend counterpart (`/api/note/constraints-full`) has real pytest coverage in `nb-web-tests/test_constraints.py`.

## nb-web docs
User: `nb-web/plugins/nbweb-hledger.md` (served in-app via `helpUrl`) and this repo's own `README.md` — both should stay in sync with what's documented here. Dev: this file, `docs:dev/dev-plugins.md` (`NbSpecialty` extension point), `docs:dev/dev-frontmatter-editor.md` (`constraints:`/`required:`/the three-ways-to-fill-in-fields pattern), chart impl notes in CODEBLOCKS.md. Full design in claude: note above.
