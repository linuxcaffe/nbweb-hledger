#!/usr/bin/env node
/**
 * test-item-new-picker.js — DOM-level verification of _itemNewPicker
 * (the item specialty header's "🆕 New" button, in nbweb-hledger.js).
 *
 * Same middle-ground approach as test-item-fields-modal.js (jsdom, not
 * pytest/Playwright) -- loads the actual plugin source and drives it
 * against a real file-input change event.
 *
 * jsdom doesn't implement DataTransfer, so file selection is simulated by
 * directly assigning input.files to a plain array of real File objects
 * (input.files is normally read-only in a browser; jsdom tolerates the
 * Object.defineProperty override). _itemNewPicker only ever does
 * `[...input.files]`, so a plain array works fine as a stand-in for a
 * FileList.
 *
 * Verifies:
 *   - a hidden multi-select, image-accept file input is created and clicked
 *   - selecting files POSTs a FormData with `notebook` + one `files` entry
 *     per selected file to /api/item/new
 *   - the input element is removed from the DOM after selection (no litter)
 *   - on success, the button resets (not left disabled/spinning) and
 *     NbWeb.refreshList() is called so new items show up without navigating
 *     away from the item you were on when you clicked New
 *
 * Usage:
 *   npm install          (jsdom, once -- shared with test-item-fields-modal.js)
 *   node test-item-new-picker.js
 *
 * Exits non-zero on any assertion failure.
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const HLEDGER_JS = path.resolve(__dirname, '../nbweb-hledger.js');

function loadPluginIIFE(filePath) {
    const src = fs.readFileSync(filePath, 'utf8');
    return src.replace('(() => {', '').replace(/\}\)\(\);?\s*$/, '');
}

async function main() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.File = dom.window.File;
    global.FormData = dom.window.FormData;
    global.localStorage = { getItem: () => null, setItem: () => {} };
    let refreshCalled = false;
    global.NbWeb = { registerModule: () => {}, refreshList: () => { refreshCalled = true; } };
    global.NbSpecialty = null;
    global.NbMain = { openNote: () => {} };

    eval(loadPluginIIFE(HLEDGER_JS));

    document.body.innerHTML =
        '<div class="nb-specialty-actions"><button class="nb-specialty-action" data-action="item-new">🆕 New</button></div>';

    const note = { notebook: 'preciousfinds.ca', selector: 'preciousfinds.ca:items/whatever.md' };

    let capturedForm = null;
    global.fetch = (url, opts) => {
        capturedForm = opts.body;
        return Promise.resolve({ json: () => ({
            success: true,
            results: [
                { file: 'a.jpg', ok: true, item: 'a', selector: 'preciousfinds.ca:items/a.md' },
                { file: 'b.jpg', ok: true, item: 'b', selector: 'preciousfinds.ca:items/b.md' },
            ],
        }) });
    };

    _itemNewPicker(note);

    const input = document.querySelector('input[type=file]');
    assert.ok(input, 'file input was not created');
    assert.strictEqual(input.multiple, true, 'input must allow multi-select');
    assert.strictEqual(input.accept, 'image/*', 'input must be image-filtered');

    Object.defineProperty(input, 'files', {
        value: [
            new File(['bytes1'], 'a.jpg', { type: 'image/jpeg' }),
            new File(['bytes2'], 'b.jpg', { type: 'image/jpeg' }),
        ],
        configurable: true,
    });
    input.dispatchEvent(new dom.window.Event('change'));
    await new Promise(r => setTimeout(r, 10));

    assert.ok(!document.body.contains(input), 'file input should be removed from the DOM after selection');
    assert.ok(capturedForm, 'no fetch was made');
    assert.strictEqual(capturedForm.get('notebook'), 'preciousfinds.ca', 'notebook not sent correctly');
    assert.strictEqual(capturedForm.getAll('files').length, 2, 'expected 2 files in the FormData');

    const btn = document.querySelector('[data-action="item-new"]');
    assert.strictEqual(btn.disabled, false, 'button should not be left disabled after success');
    assert.strictEqual(btn.textContent, '🆕 New', 'button should reset to its original label on full success');
    assert.ok(refreshCalled, 'NbWeb.refreshList() should be called so new items appear without navigating away');

    console.log('✓ all assertions passed (multi-select image input, correct FormData, cleanup, quiet success)');
}

main().catch(e => { console.error('✗ FAILED:', e.message); process.exit(1); });
