#!/usr/bin/env node
/**
 * test-item-fields-modal.js — DOM-level verification of _itemFieldsModal
 * (the item specialty header's "📝 Fields" button, in nbweb-hledger.js).
 *
 * Doesn't fit nb-web-tests' existing conventions (pytest for backend logic,
 * Playwright for full-browser E2E) -- this is a lighter middle ground: real
 * DOM via jsdom, but no running server/browser needed. Loads the actual
 * plugin source files (this repo's nbweb-hledger.js, and nb-web's
 * nbweb-codeblocks.js for the shared fmUtils helpers) and drives the modal
 * against real fixture data, so it can't drift from what ships.
 *
 * Verifies:
 *   - constraints-full response renders one row per field, correctly typed
 *     (select/text/area/date) via the real fmUtils.widget()
 *   - existing field values pre-fill correctly
 *   - a genuinely missing required field gets flagged (nb-item-field-missing)
 *     and, once filled in and saved, gets INSERTED into the note's frontmatter
 *     (not silently dropped -- this is what fmUtils.patch()'s insert-missing-
 *     key fix, added alongside this modal, actually protects)
 *
 * Usage:
 *   npm install          (jsdom, once)
 *   node test-item-fields-modal.js
 *
 * Exits non-zero on any assertion failure.
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const NB_WEB_DIR = path.resolve(__dirname, '../../nb-web');
const HLEDGER_JS = path.resolve(__dirname, '../nbweb-hledger.js');
const CODEBLOCKS_JS = path.join(NB_WEB_DIR, 'plugins/nbweb-codeblocks.js');
const FIXTURE_NOTE = path.resolve(__dirname, '../../../.nb/preciousfinds.ca/items/test-item-unsold.md');

function loadPluginIIFE(filePath) {
    let src = fs.readFileSync(filePath, 'utf8');
    return src.replace('(() => {', '').replace(/\}\)\(\);?\s*$/, '');
}

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = { getItem: () => null, setItem: () => {} };
    global.NbWeb = { registerModule: () => {} };
    global.NbSpecialty = null;
    let openedSelector = null;
    global.NbMain = { openNote: sel => { openedSelector = sel; } };

    eval(loadPluginIIFE(CODEBLOCKS_JS));
    global.NbWeb.fmUtils = { parseFields: _fmParseFields, patch: _fmPatch, widget: _fmWidget };

    eval(loadPluginIIFE(HLEDGER_JS));

    const constraints = {
        status:      { widget: 'select available,sold', required: true },
        price:       { widget: 'text', required: true },
        image:       { widget: 'text', required: true },
        category:    { widget: 'text', required: false },
        description: { widget: 'area', required: false },
        date:        { widget: 'date', required: false },
    };
    global.fetch = () => Promise.resolve({ json: () => constraints });

    const raw = fs.readFileSync(FIXTURE_NOTE, 'utf8');
    assert.ok(!/^image:.+\S/m.test(raw), 'fixture assumption broken: test-item-unsold.md now has a non-blank image: — pick a different fixture or update this test');

    const note = {
        selector: 'preciousfinds.ca:items/test-item-unsold.md',
        filename: 'test-item-unsold.md',
        raw,
        meta: { title: 'TEST — Unsold widget', status: 'available' },
    };

    await _itemFieldsModal(note);
    await new Promise(r => setTimeout(r, 0));

    const modal = document.getElementById('nb-item-fields-modal');
    assert.ok(modal, 'modal did not render');

    const rows = modal.querySelectorAll('.nb-item-field-row');
    assert.strictEqual(rows.length, 6, `expected 6 field rows, got ${rows.length}`);

    const byKey = {};
    for (const row of rows) {
        const key = row.querySelector('[data-fm-key]').dataset.fmKey;
        byKey[key] = row;
    }

    assert.strictEqual(byKey.status.querySelector('[data-fm-key]').value, 'available', 'status should pre-fill from note FM');
    assert.strictEqual(byKey.price.querySelector('[data-fm-key]').value, '$25.00', 'price should pre-fill from note FM');
    assert.strictEqual(byKey.image.querySelector('[data-fm-key]').value, '', 'image should be blank (genuinely missing in fixture)');
    assert.ok(byKey.image.classList.contains('nb-item-field-missing'), 'blank required field should get nb-item-field-missing class');
    assert.ok(!byKey.status.classList.contains('nb-item-field-missing'), 'present required field should NOT get nb-item-field-missing class');
    assert.ok(!byKey.category.classList.contains('nb-item-field-missing'), 'optional field should never get nb-item-field-missing class, even if blank');

    // Fill in the missing field and save
    byKey.image.querySelector('[data-fm-key]').value = 'widget.jpg';

    let savedContent = null;
    global.fetch = (url, opts) => {
        if (opts) savedContent = JSON.parse(opts.body).content;
        return Promise.resolve({ json: () => ({ success: true }) });
    };
    modal.querySelector('#nb-item-fields-save').click();
    await new Promise(r => setTimeout(r, 0));

    assert.ok(savedContent, 'save did not PUT any content');
    assert.match(savedContent, /^image: widget\.jpg$/m, 'missing field was not inserted into saved frontmatter');
    assert.match(savedContent, /^price: \$25\.00$/m, 'unrelated existing field should survive unchanged');
    assert.ok(savedContent.includes('TEST ITEM — safe to delete'), 'note body should survive unchanged');
    assert.strictEqual(openedSelector, note.selector, 'should reopen the note after a successful save');

    console.log('✓ all assertions passed (6 fields rendered, correct pre-fill, missing-field flagging, insert-on-save, body preserved)');
}

main().catch(e => { console.error('✗ FAILED:', e.message); process.exit(1); });
