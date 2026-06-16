# NbWeb-hledger — CLAUDE.md

External nb-web plugin. One file: `nbweb-hledger.js`. Loaded via `nb-settings.json`.

## What it does
Domain knowledge layer on top of hledger: CoA wizard, Canadian tax mappings, chart codeblock, account/template/period/report note types. Not a data viewer — hledger does that. This is the opinionated layer.

## Key files
| Path | Role |
|------|------|
| `nbweb-hledger.js` | The plugin — all frontend code |
| `README.md` | User docs + chart block reference + implementation notes |
| `claude:nbweb-hledger_plugin_design.md` | 600-line canonical design doc (CoA hierarchies, personas, build order) — authoritative, do not archive |

## chart codeblock invariants
- Revenue (`type:R`) is **negative** in hledger bal output — negate for cashflow income series
- `typeof NbNav !== 'undefined' ? NbNav.notebook : ''` — NbNav is `const` not on `window`
- Sequential `for...of` (not `Promise.all`) — Chart.js touches shared canvas state
- Doughnut: `aspectRatio: 1.5`

## Plugin registration
`NbWeb.registerModule('hledger', { detect, codeblockRenderers, previewRenderer, listDefaults, sortOptions, listItemIcon })`
`detect`: notebooks with `.nb-hledger.json` anchor file.

## Note types
`account`, `template`, `period`, `report` — icons 📒📋📅📊. Rendered by `previewRenderer`.
`previewRenderer` must use `NbMain.renderMarkdown(body, selector)` not `marked.parse()`.

## Audiences (priority order)
1. Personal finance — Canadian, TFSA/RRSP/FHSA, T1
2. Small business — HST by province, T2125
3. Production accounting — above/below the line, CPTC

## nb-web docs
User: none yet. Dev: `docs:dev/` has chart impl notes in CODEBLOCKS.md. Full design in claude: note above.
