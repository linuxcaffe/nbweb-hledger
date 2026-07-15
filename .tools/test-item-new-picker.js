#!/usr/bin/env node
/**
 * test-item-new-picker.js — DOM-level verification of _itemNewPicker /
 * _itemNewModal (the item specialty header's "🆕 New" button, in
 * nbweb-hledger.js).
 *
 * Same middle-ground approach as test-item-fields-modal.js (jsdom, not
 * pytest/Playwright) -- loads the actual plugin source and drives it
 * against a real file-input change event and modal form submission.
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
 *   - selecting files opens a confirm modal (not an immediate upload) listing
 *     one row per file, first flagged "primary"
 *   - Create is a no-op until both code and title are filled in
 *   - submitting POSTs a FormData with notebook/code/title + one `files`
 *     entry per selected file to /api/item/new -- ONE item, not one per file
 *   - on success: the modal closes, NbWeb.refreshList() runs, the new note
 *     is opened (NbMain.openNote), and the Fields modal auto-opens on it
 *     (chaining into the existing constraints-driven fields flow so a bare
 *     new item doesn't dead-end silently)
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

const NB_WEB_DIR    = path.resolve(__dirname, '../../nb-web');
const HLEDGER_JS     = path.resolve(__dirname, '../nbweb-hledger.js');
const CODEBLOCKS_JS  = path.join(NB_WEB_DIR, 'plugins/nbweb-codeblocks.js');

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
    let openedSelector = null;
    global.NbMain = { openNote: sel => { openedSelector = sel; } };

    eval(loadPluginIIFE(CODEBLOCKS_JS));
    global.NbWeb.fmUtils = { parseFields: _fmParseFields, patch: _fmPatch, widget: _fmWidget };

    eval(loadPluginIIFE(HLEDGER_JS));

    document.body.innerHTML =
        '<div class="nb-specialty-actions"><button class="nb-specialty-action" data-action="item-new">🆕 New</button></div>';

    const note = { notebook: 'preciousfinds.ca', selector: 'preciousfinds.ca:items/whatever.md' };

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

    const modal = document.getElementById('nb-item-new-modal');
    assert.ok(modal, 'confirm modal did not render after file selection');
    const fileRows = modal.querySelectorAll('.nb-item-new-file');
    assert.strictEqual(fileRows.length, 2, 'expected one row per selected file');
    assert.match(fileRows[0].textContent, /primary/, 'first file should be flagged primary');
    assert.match(fileRows[0].textContent, /a\.jpg/);
    assert.match(fileRows[1].textContent, /b\.jpg/);

    const codeInput  = modal.querySelector('#nb-item-new-code');
    const titleInput = modal.querySelector('#nb-item-new-title');
    const createBtn  = modal.querySelector('#nb-item-new-create');
    assert.ok(codeInput && titleInput && createBtn, 'code/title inputs or Create button missing');

    // Create with both fields blank must be a no-op (no fetch, modal stays open)
    let fetchCalled = false;
    global.fetch = () => { fetchCalled = true; return Promise.resolve({ json: () => ({}) }); };
    createBtn.click();
    await new Promise(r => setTimeout(r, 0));
    assert.strictEqual(fetchCalled, false, 'Create with blank code/title must not upload anything');
    assert.ok(document.getElementById('nb-item-new-modal'), 'modal should stay open when required fields are blank');

    codeInput.value  = 'ABC123';
    titleInput.value = 'Vintage Widget';

    let capturedForm = null;
    let capturedUrl  = null;
    const freshNote = { selector: 'preciousfinds.ca:items/ABC123.md', raw: '---\ntitle: Vintage Widget\n---\n', meta: { title: 'Vintage Widget' } };
    const constraintsFixture = { title: { widget: 'text', required: true } };
    global.fetch = (url, opts) => {
        if (url === '/api/item/new') {
            capturedForm = opts.body;
            return Promise.resolve({ json: () => ({
                success: true, item: 'ABC123',
                selector: 'preciousfinds.ca:items/ABC123.md',
                images: ['ABC123.jpg', 'ABC123-1.jpg'], failures: [],
            }) });
        }
        if (url.startsWith('/api/note/constraints-full')) {
            return Promise.resolve({ json: () => constraintsFixture });
        }
        // /api/note?selector=... refetch that feeds the auto-opened Fields modal
        capturedUrl = url;
        return Promise.resolve({ json: () => freshNote });
    };
    createBtn.click();
    await new Promise(r => setTimeout(r, 10));

    assert.ok(capturedForm, 'no fetch was made to /api/item/new');
    assert.strictEqual(capturedForm.get('notebook'), 'preciousfinds.ca', 'notebook not sent correctly');
    assert.strictEqual(capturedForm.get('code'), 'ABC123');
    assert.strictEqual(capturedForm.get('title'), 'Vintage Widget');
    assert.strictEqual(capturedForm.getAll('files').length, 2, 'expected 2 files in the FormData (one item, two images)');

    assert.ok(!document.getElementById('nb-item-new-modal'), 'confirm modal should close on success');
    assert.ok(refreshCalled, 'NbWeb.refreshList() should be called so the new item appears without navigating away');
    assert.strictEqual(openedSelector, 'preciousfinds.ca:items/ABC123.md', 'should navigate to the newly created item');
    assert.ok(capturedUrl && capturedUrl.includes('ABC123.md'), 'should refetch the fresh note for the auto-opened Fields modal');
    assert.ok(document.getElementById('nb-item-fields-modal'), 'Fields modal should auto-open on the new (bare) item');

    console.log('✓ all assertions passed (multi-image single-item picker, blank-field guard, correct FormData, cleanup, navigate + auto-open Fields)');
}

main().catch(e => { console.error('✗ FAILED:', e.message); process.exit(1); });
