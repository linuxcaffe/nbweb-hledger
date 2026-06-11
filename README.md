# NbWeb-hledger

An [nb-web](https://github.com/linuxcaffe/nb-web) plugin that adds plain-text accounting support to the nb notebook interface, using [hledger](https://hledger.org/) as the engine.

This is not a replacement for hledger's CLI — it's an opinionated knowledge layer on top: Canadian tax domain packs, a Chart of Accounts setup wizard, account autocomplete, and inline journal entry.

## Features

- **Chart of Accounts wizard** — domain picker (personal / small business), province picker (drives HST vs GST+PST vs GST+QST structure), option checkboxes, preview and generate
- **CRA tax mappings** — T1 (personal) and T2125 (self-employment) line numbers on account notes
- **Account autocomplete** — powered by `hledger accounts --flat` against your full include chain
- **Inline journal entry** — add transactions without leaving nb-web
- **Four note types** — `account`, `template`, `period`, `report`
- **Province-aware tax accounts** — all 13 provinces and territories

## Installation

1. Install [nb-web](https://github.com/linuxcaffe/nb-web)
2. Copy `nbweb-hledger.js` to `nb-web/plugins/`
3. Add to `nb-settings.json` plugins list:
   ```json
   { "url": "/plugins/nbweb-hledger.js", "enabled": true }
   ```
4. Create `.nb-hledger.json` in a notebook directory — see [setup guide](https://github.com/linuxcaffe/nb-web/blob/main/plugins/requirements/hledger-setup.md)

## License

[AGPL v3](LICENSE) — copyleft applies to network use (SaaS)
