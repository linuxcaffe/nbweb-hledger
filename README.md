# NbWeb-hledger

An [nb-web](https://github.com/linuxcaffe/nb-web) plugin that adds plain-text accounting and service business tracking to the nb notebook interface, using [hledger](https://hledger.org/) as the engine.

This is not a replacement for hledger's CLI — it's an opinionated knowledge layer on top: Canadian tax domain packs, a Chart of Accounts setup wizard, account autocomplete, specialty note types, and a full invoice generation pipeline.

**Three audiences, in priority order:**
1. **Personal finance** — individual, Canadian, TFSA/RRSP/FHSA, T1 tax prep
2. **Small business / service business** — sole proprietor, HST by province, T2125, project diaries, invoicing
3. **Production accounting** — film/commercial, above/below the line, CPTC and provincial credits

---

## Features

### Accounting
- **Chart of Accounts wizard** — domain picker (personal / small business), province picker (drives HST vs GST+PST structure), preview and generate
- **CRA tax mappings** — T1 (personal) and T2125 (self-employment) line numbers on account notes
- **Account autocomplete** — powered by `hledger accounts --flat` against your full include chain
- **`chart` codeblock** — interactive Chart.js visualisations (cashflow, networth, expenses, pies)

### Service business pack
- **Project diary** (`type: project`) — timedot time-tracking + materials CSV in a single dated note
- **Reports** (`type: reports`) — live hledger queries + Invoice / Quote action buttons
- **Invoice generation** — preflight dialog, per-day labour detail, contact lookup, progressive billing
- **journals/ auto-sync** — timedot blocks → labour journal; CSV blocks → materials journal; no scripts
- **Specialty note types** — `project`, `reports`, `budget`, `invoice`, `tools`, `materials`, `transport`

---

## Installation

1. Install [nb-web](https://github.com/linuxcaffe/nb-web)
2. Clone this repo alongside nb-web:
   ```bash
   git clone https://github.com/linuxcaffe/nbweb-hledger ~/dev/nbweb-hledger
   ```
3. Add to `nb-settings.json` plugins list:
   ```json
   { "url": "file:///home/YOU/dev/nbweb-hledger/nbweb-hledger.js", "enabled": true }
   ```
4. Create `.nb-hledger.json` in a notebook to activate the plugin for that notebook.

---

## Service business pack

### Project folder layout

```
projects/
  gbct/                          ← client folder
    invoices/
      INV-2026-001.md            ← generated; type: invoice; shared across all projects
    nathan/                      ← project folder
      nathan.md                  ← type: project; diary + timedot + csv blocks
      nathan-reports.md          ← type: reports; live hledger queries; Invoice button
      journals/
        nathan.journal            ← master include file
        nathan.timedot            ← auto-rebuilt from timedot blocks on every save
        nathan.labour.journal     ← auto-rebuilt: timedot entries × rate → explicit CAD
        nathan.materials.journal  ← auto-rebuilt from csv materials block on save
```

### Project diary (`type: project`)

The diary note is the source of truth. It accumulates dated sections with timedot and CSV blocks:

```yaml
---
type: project
project: gbct:nathan
rate: 30
billing_type: cash        # or t&m
client: "contacts:gbct.md"
timedot_file: /abs/path/to/journals/nathan.timedot
journal: /abs/path/to/journals/nathan.journal
csv: [materials, tools]
foldable: '\d{4}-\d{2}-\d{2}'
---
```

```markdown
## 2026-06-18

```timedot
2026-06-18
 gbct:nathan:flooring  5  ; tearing out carpet
```

```csv materials
Item, Qty, Unit, Unit Cost, Total, Notes
Primer, 2, L, 18.00, 36.00,
```
```

**Date injection:** timedot blocks without a date line inherit the nearest preceding `## YYYY-MM-DD` heading automatically.

**Foldable sections:** `foldable: '\d{4}-\d{2}-\d{2}'` collapses all date headings for a clean diary view.

**+ Today button:** specialty header appends `## YYYY-MM-DD` and opens the editor.

### journals/ auto-sync

Every file in `journals/` is kept current by nb-web — no cron jobs or gen scripts needed.

| Trigger | Writes |
|---------|--------|
| Timedot block saved | `nathan.timedot` (full rebuild) + `nathan.labour.journal` (explicit CAD entries) |
| CSV materials block saved | `nathan.materials.journal` |
| First timedot save on a new project | Stubs all missing journal files |

**Why a separate labour journal?** hledger's timedot virtual postings are unitless — `-X CAD` can't convert them via `P` directives. The labour journal writes explicit `CAD` amounts (`hours × rate`), so `bal Income` and `reg` work natively without commodity conversion.

**Account convention:** `Assets:AR:gbct:nathan` — short `AR:` form throughout.

**hledger cache:** cleared on every journal write, since master journal mtime doesn't change when sub-journals change.

### Reports note (`type: reports`)

```yaml
---
type: reports
project: gbct:nathan
journal: /abs/path/to/journals/nathan.journal
billing_type: cash
rate: 30
client: "contacts:gbct.md"
---
```

Specialty header shows live budget totals and **Quote** / **Invoice** action buttons.

### Invoice generation

#### Flow

1. Open a `type: reports` note → click **🧾 Invoice**
2. Preflight reads labour + materials totals, suggests next `INV-YYYY-NNN`
   - Counter scans the client-level `invoices/` folder — sequential across all projects for that client
3. Dialog shows item breakdown; confirm/edit Invoice #, Date, Due, Notes
4. Generate writes `projects/gbct/invoices/INV-2026-001.md` and opens it

#### Billing types

| Type | HST | AR entry | Income entry |
|------|-----|----------|--------------|
| `cash` | Not collected; personal filing | `labour + materials` | Full amount |
| `t&m` | 13% on subtotal | `subtotal × 1.13` | Subtotal; HST → `Liabilities:HST:Collected` |

#### Invoice template

Templates live in `djp:.templates/invoice-cash.md` (or `invoice-tm.md`). The plugin looks in the notebook's `.templates/` first, then `~/.nb/.templates/`.

Template variables: `{{invoice_num}}`, `{{issued}}`, `{{due}}`, `{{to_block}}`, `{{re_line}}`,
`{{labour_lines}}`, `{{total_line}}`, `{{notes_section}}`, `{{ledger_block}}`,
`{{client}}`, `{{client_raw}}`, `{{project}}`, `{{rate}}`, `{{reports_selector}}`

- **`{{to_block}}`** — resolved from `contacts/` notebook via `client:` FM key, then project prefix fallback; formats name, org, address
- **`{{re_line}}`** — `project: nathan (flooring, paint, electrical)` — project stem + unique timedot sub-categories
- **`{{labour_lines}}`** — one Markdown table row per diary session (date, description, hours, rate, amount)
- **`{{ledger_block}}`** — canonical hledger entries for your books (AR + income at invoice time; commented payment template)

#### Progressive billing

On successful generate, an HTML comment is appended to the **project diary**:
```
<!-- INVOICED: INV-2026-001  2026-06-27  $1275.00 cash -->
```

The next invoice only includes work logged after this date. The marker is invisible in the rendered diary but fully searchable (`nb g "INVOICED"`). To regenerate the same period: delete the marker line from the diary.

#### Invoice note (`type: invoice`)

Specialty header shows:
- Pills: invoice number · due date · status (🟡 due / 🟢 paid)
- **✅ Mark Paid** — prompts for payment date, writes `status: paid` + `paid: YYYY-MM-DD` to frontmatter
- **🖨️ Print** — opens a clean popup window (renders from `note.raw`, strips FM and ledger block), triggers print dialog for PDF export

---

## chart — Financial Charts codeblock

````markdown
```chart
cashflow thisyear
```
````

**Report types:**

| Report | Chart | Description |
|--------|-------|-------------|
| `cashflow` | bar + line | Monthly income vs expenses, cumulative net change |
| `networth` | line | Assets, liabilities, and net worth over time |
| `expenses` | stacked bar | Monthly expense breakdown by category |
| `expenses-pie` | doughnut | Expense share by category for the period |
| `assets-pie` | doughnut | Asset allocation snapshot |
| `income-pie` | doughnut | Income sources for the period |

**Period** is any hledger period expression: `thismonth`, `thisyear`, `lastyear`, `last3months`, `2025`, `2025-01..2025-06`, etc.

**`depth:N`** controls account depth for category breakdown (default `2`):

````markdown
```chart
expenses thisyear depth:3
```
````

**Header controls:** `▾/▸` collapse · `mo / yr / prev` quick period switcher · `◕/▦` doughnut ↔ bar toggle · `↺` force reload

---

## chart — Implementation notes

**Revenue is negative** in `hledger bal` output — negate the income series for cashflow chart.

**CSV parsing** — `_hl_bal_csv()` skips title rows. Handles monthly format (one column per month) and period-total format (single `balance` column).

**`NbNav` scope** — declared `const`, not on `window`. Use `typeof NbNav !== 'undefined' ? NbNav.notebook : ''`.

**Doughnut sizing** — `aspectRatio: 1.5` keeps height ~30% smaller than Chart.js default square.

**Sequential rendering** — `for...of` not `Promise.all`; Chart.js touches shared canvas state.

---

## Note types

| Type | Icon | Role |
|------|------|------|
| `account` | 📒 | Account documentation; CRA line numbers; hledger_account FM key |
| `template` | 📋 | Journal entry templates |
| `period` | 📅 | Reporting period definitions |
| `report` | 📊 | Saved hledger report views |
| `project` | 🏗️ | Service project diary; timedot + csv blocks |
| `reports` | 📊 | Live hledger queries; Invoice/Quote buttons |
| `budget` | 💰 | Project budget summary |
| `invoice` | 🧾 | Generated client invoice; Mark Paid; Print |
| `tools` | 🔧 | Tool inventory catalog |
| `materials` | 🧱 | Materials price catalog |
| `transport` | 🚗 | Vehicle and mileage tracking |

---

## License

[AGPL v3](LICENSE) — copyleft applies to network use (SaaS)
