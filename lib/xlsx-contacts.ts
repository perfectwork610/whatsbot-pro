import { read, utils } from 'xlsx';
import type { ImportedContact } from './csv';

function cellText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Digits only; prepend Brazil country code for local DDD numbers. */
export function normalizeImportPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) return digits;
  // Brazilian landline/mobile with area code: 10 or 11 digits.
  if (/^[1-9]\d{9,10}$/.test(digits)) return `55${digits}`;
  return digits;
}

function pick(
  row: Record<string, unknown>,
  map: Map<string, string>,
  ...aliases: string[]
): string {
  for (const alias of aliases) {
    const key = map.get(normalizeHeader(alias));
    if (key) {
      const value = cellText(row[key]);
      if (value) return value;
    }
  }
  return '';
}

function headerMap(row: Record<string, unknown>): Map<string, string> {
  const map = new Map<string, string>();
  for (const key of Object.keys(row)) map.set(normalizeHeader(key), key);
  return map;
}

function isProspectingSheet(map: Map<string, string>): boolean {
  const hasPhone = ['telefone', 'telefone 1', 'phone', 'celular'].some((h) => map.has(h));
  const hasCompany = ['empresa', 'nome fantasia', 'razao social', 'cnpj'].some((h) => map.has(h));
  return hasPhone && hasCompany;
}

function contactFromProspectingRow(
  row: Record<string, unknown>,
  map: Map<string, string>,
  phoneRaw: string,
): ImportedContact | null {
  const phone = normalizeImportPhone(phoneRaw);
  if (!phone) return null;
  const fantasy = pick(row, map, 'nome fantasia', 'nome_fantasia');
  const company = pick(row, map, 'empresa', 'razao social', 'razão social');
  const partner = pick(row, map, 'socio principal', 'sócio principal');
  const name = (fantasy || company || partner || phone).slice(0, 200);
  const cnpj = pick(row, map, 'cnpj');
  const city = pick(row, map, 'cidade');
  const state = pick(row, map, 'estado', 'uf');
  const activity = pick(row, map, 'atividade principal');
  const sourceParts = [
    'Planilha de prospecção XLSX',
    cnpj && `CNPJ ${cnpj}`,
    city && state ? `${city}/${state}` : city || state,
    activity,
  ].filter(Boolean);
  return {
    name,
    phone,
    source: sourceParts.join(' · ').slice(0, 500),
    consent: true,
  };
}

/** Parse prospecting-style XLSX (EMPRESA, TELEFONE, …) into import rows. */
export function parseContactSpreadsheet(data: ArrayBuffer): ImportedContact[] {
  const workbook = read(data, { type: 'array', cellDates: false });
  const sheetName =
    workbook.SheetNames.find((name) => /empresa/i.test(name)) || workbook.SheetNames[0];
  if (!sheetName) throw new Error('A planilha está vazia.');
  const sheet = workbook.Sheets[sheetName];
  const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (!rows.length) throw new Error('A lista está vazia. Adicione pelo menos um telefone.');
  const map = headerMap(rows[0]);
  if (!isProspectingSheet(map)) {
    throw new Error(
      'Use uma planilha XLSX de prospecção com as colunas EMPRESA e TELEFONE, ou importe CSV/TXT.',
    );
  }
  const contacts: ImportedContact[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const phones = [
      pick(row, map, 'telefone', 'telefone 1', 'phone', 'celular'),
      pick(row, map, 'telefone 2', 'telefone2', 'phone 2', 'celular 2'),
    ].filter(Boolean);
    for (const phoneRaw of phones) {
      const contact = contactFromProspectingRow(row, map, phoneRaw);
      if (!contact || seen.has(contact.phone)) continue;
      seen.add(contact.phone);
      contacts.push(contact);
    }
  }
  if (!contacts.length) throw new Error('A lista está vazia. Adicione pelo menos um telefone.');
  return contacts;
}
