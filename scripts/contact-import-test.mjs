import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseCSV, parseContactList, contactImportBatches } from '../lib/csv.ts';
const plain = '\uFEFF+1 (202) 555-0101\r\n\r\n12025550102\r\n12025550103\r\n';
const rows = parseContactList(plain);
assert.equal(rows.length, 3);
assert.equal(rows[0].phone, '+1 (202) 555-0101');
assert.deepEqual(
  rows.map((row) => [row.name, row.consent, row.source]),
  [
    ['', true, ''],
    ['', true, ''],
    ['', true, ''],
  ],
);
assert.equal(parseContactList('"12025550101"\n"12025550102"')[0].phone, '12025550101');
assert.equal(parseContactList('12025550101,12025550102\n12025550103,12025550104').length, 4);
assert.equal(parseContactList('telefone\n12025550101')[0].phone, '12025550101');
assert.equal(
  parseContactList('\nnome;telefone;consentimento;origem\n"Name; example";12025550101;sim;Site')[0]
    .name,
  'Name; example',
);
assert.equal(
  parseContactList('name,phone,consent,source\nAlice,12025550101,yes,Website')[0].consent,
  true,
);
assert.equal(
  parseContactList('name,phone,consent,source\nBob,12025550102,no,Website')[0].consent,
  true,
);
assert.equal(parseContactList('phone\ninvalid\n12025550101').length, 2);
assert.throws(() => parseContactList(' \n\n'), /vazia/);
assert.throws(() => parseCSV('"12025550101'), /aspas/);
const example = fs.existsSync('docs/contacts.example.csv')
  ? fs.readFileSync('docs/contacts.example.csv', 'utf8')
  : Array.from({ length: 36146 }, (_, i) => String(12025550000 + i)).join('\n');
const expected = example
  .replace(/^\uFEFF/, '')
  .split(/\r?\n/)
  .filter((line) => line.trim());
const parsed = parseContactList(example);
assert.equal(parsed.length, expected.length);
assert.equal(parsed[0].phone, expected[0].trim());
assert.equal(parsed.at(-1).phone, expected.at(-1).trim());
assert.ok(parsed.every((row) => row.consent && !row.source && !row.name));
const batches = contactImportBatches(parsed);
assert.equal(batches.flat().length, parsed.length);
assert.ok(
  batches.every(
    (batch) =>
      batch.length <= 5000 &&
      Buffer.byteLength(JSON.stringify({ action: 'contacts', rows: batch })) < 2_000_000,
  ),
);
const rich = Array.from({ length: 5000 }, () => ({
  name: '测'.repeat(200),
  phone: '12025550101',
  consent: false,
  source: '试'.repeat(500),
}));
assert.ok(
  contactImportBatches(rich).every(
    (batch) => Buffer.byteLength(JSON.stringify({ action: 'contacts', rows: batch })) < 2_000_000,
  ),
);
const { parseContactSpreadsheet, normalizeImportPhone } = await import('../lib/xlsx-contacts.ts');
assert.equal(normalizeImportPhone('(85) 98154-6500'), '5585981546500');
assert.equal(normalizeImportPhone('5585999999999'), '5585999999999');
const xlsxPath = 'docs/prospecting-sample.xlsx';
if (fs.existsSync(xlsxPath)) {
  const workbookRows = parseContactSpreadsheet(
    fs.readFileSync(xlsxPath).buffer,
    'prospecting-sample.xlsx',
  );
  assert.ok(workbookRows.length >= 30, 'prospecting sample should yield contacts');
  assert.equal(workbookRows[0].consent, true);
  assert.match(workbookRows[0].phone, /^55\d{10,11}$/);
  assert.ok(workbookRows[0].name);
  assert.equal(workbookRows[0].source, 'prospecting-sample.xlsx');
  assert.ok(workbookRows.every((row) => row.source === 'prospecting-sample.xlsx'));
  console.log(
    `Phone-only TXT/CSV, bilingual headers, consent defaults, XLSX prospecting, and payload-size checks passed. Example: ${parsed.length} CSV rows in ${batches.length} batches; XLSX ${workbookRows.length} contacts. No contacts were saved.`,
  );
} else {
  console.log(
    `Phone-only TXT/CSV, bilingual headers, consent defaults, and payload-size checks passed. Example: ${parsed.length} rows in ${batches.length} batches. No contacts were saved.`,
  );
}
