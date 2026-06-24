# NbWeb-hledger

An [nb-web](https://github.com/linuxcaffe/nb-web) plugin that adds plain-text accounting support to the nb notebook interface, using [hledger](https://hledger.org/) as the engine.

This is not a replacement for hledger's CLI — it's an opinionated knowledge layer on top: Canadian tax domain packs, a Chart of Accounts setup wizard, account autocomplete, and inline journal entry.

Unlike every other nb-web plugin, NbWeb-hledger is not primarily a data viewer — hledger already does that magnificently. The plugin's job is to provide *domain knowledge*: the structured understanding of accounting practice, Canadian tax law, and best-practice journal organisation that hledger itself has no opinion about. hledger is a brilliant, freeform tool. The plugin is the opinionated layer on top.

**Three audiences, in priority order:**
1. **Personal finance** — individual, Canadian, TFSA/RRSP/FHSA, T1 tax prep
2. **Small business** — sole proprietor or incorporated, HST by province, T2125
3. **Production accounting** — film/commercial, above/below the line, CPTC and provincial credits

**Design principles:**

- **Symlinks, not copies.** The actual journal files live wherever they've always lived. The nb notebook contains symlinks pointing to them. hledger CLI, cron jobs, scripts — everything that already uses the journal continues to work unchanged.
- **Plain files all the way down.** Account documentation, templates, checklists, report collections — all Markdown with YAML frontmatter. Editable in any text editor, version-controlled with git, portable forever.
- **Help text is a first-class feature.** hledger's power comes with a learning curve. The plugin surfaces domain knowledge contextually — not a manual, but the answer to the question the user is about to have.

## Features

- **Chart of Accounts wizard** — domain picker (personal / small business), province picker (drives HST vs GST+PST vs GST+QST structure), option checkboxes, preview and generate
- **CRA tax mappings** — T1 (personal) and T2125 (self-employment) line numbers on account notes
- **Account autocomplete** — powered by `hledger accounts --flat` against your full include chain
- **Inline journal entry** — add transactions without leaving nb-web
- **Four note types** — `account`, `template`, `period`, `report`
- **Province-aware tax accounts** — all 13 provinces and territories

## Installation

1. Install [nb-web](https://github.com/linuxcaffe/nb-web)
2. Symlink `nbweb-hledger.js` into `nb-web/plugins/` (symlink, not copy — keeps the plugin current as you update it):
   ```bash
   ln -sf ~/dev/nbweb-hledger/nbweb-hledger.js ~/dev/nb-web/plugins/nbweb-hledger.js
   ```
3. Add to `nb-settings.json` plugins list:
   ```json
   { "url": "/plugins/nbweb-hledger.js", "enabled": true }
   ```
4. Create `.nb-hledger.json` in a notebook directory — see [setup guide](https://github.com/linuxcaffe/nb-web/blob/main/plugins/requirements/hledger-setup.md)

## chart — Financial Charts codeblock

NbWeb-hledger provides the `chart` codeblock renderer — interactive Chart.js visualisations driven by hledger data.

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

**Header controls:** `▾/▸` collapse · `mo / yr / prev` quick period switcher · `◕/▦` doughnut ↔ bar toggle (on `*-pie` and `expenses`) · `↺` force reload.

---

## chart — Implementation notes

**Revenue amounts are negative** in `hledger bal` output — must negate the income series for cashflow chart (otherwise income bars point down).

**CSV parsing** — `_hl_bal_csv()` skips title rows (all values after col 0 are empty). Handles both monthly format (one column per month) and period-total format (single `balance` column). Without `--monthly`, the CSV has a single balance column — pie chart code takes `amounts[0]`.

**`window.NbNav` scope** — `NbNav` is declared `const` not `var`, so it's not on `window`. Use `typeof NbNav !== 'undefined' ? NbNav.notebook : ''` rather than `window.NbNav?.notebook`.

**Doughnut sizing** — use `aspectRatio: 1.5` to keep doughnut height ~30% smaller than Chart.js default square.

**Sequential rendering** — chart blocks use `for...of` (not `Promise.all`) because Chart.js touches shared canvas state; parallel rendering causes conflicts.

---

## License

[AGPL v3](LICENSE) — copyleft applies to network use (SaaS)
