export function parseCSV(input: string): Record<string, string>[] {
  const source = input.replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/).find((line) => line.trim()) || '';
  const delimiter = firstLine.includes(';') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && c === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (!quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && source[i + 1] === '\n') i++;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (quoted) throw new Error('CSV com aspas não fechadas.');
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  if (!rows.length) throw new Error('A lista está vazia. Adicione pelo menos um telefone.');
  const headers = rows[0].map((h) => h.toLowerCase());
  if (headers.some((h) => ['phone', 'telefone', 'numero', 'número'].includes(h))) {
    return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] || ''])));
  }
  // A one-column CSV or TXT list needs no header. Keep the first number.
  // Invalid entries are preserved so the server reports them in the import totals.
  if (rows.every((r) => r.length === 1)) return rows.map((r) => ({ phone: r[0] }));
  // Also accept a headerless CSV whose cells are phone numbers.
  if (rows[0].every((cell) => !cell || /^[+\d][\d\s()+.\-]*$/.test(cell))) {
    return rows.flatMap((r) => r.filter(Boolean).map((phone) => ({ phone })));
  }
  throw new Error('Use uma lista de telefones ou um CSV com a coluna telefone.');
}
export type ImportedContact = { name: string; phone: string; source: string; consent: boolean };
export function parseContactList(input: string): ImportedContact[] {
  return parseCSV(input).map((row) => {
    const consentRaw = (row.consentimento || row.consent || '').toLowerCase().trim();
    return {
      name: (row.nome || row.name || '').slice(0, 200),
      phone: (row.telefone || row.phone || row.numero || row['número'] || '').slice(0, 200),
      source: (row.origem || row.source || '').slice(0, 500),
      // Default granted; only explicit no/false opts out of import permission.
      consent: !['false', 'nao', 'não', '0', 'no'].includes(consentRaw),
    };
  });
}
export function contactImportBatches(rows: ImportedContact[]): ImportedContact[][] {
  const batches: ImportedContact[][] = [];
  const encoder = new TextEncoder();
  let batch: ImportedContact[] = [],
    bytes = 0;
  for (const row of rows) {
    const size = encoder.encode(JSON.stringify(row)).length + 1;
    if (batch.length && (batch.length >= 5000 || bytes + size > 1_500_000)) {
      batches.push(batch);
      batch = [];
      bytes = 0;
    }
    batch.push(row);
    bytes += size;
  }
  if (batch.length) batches.push(batch);
  return batches;
}
export function csvDownload(filename: string, rows: unknown[][]) {
  const csv =
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((value) => {
            let s = String(value ?? '');
            if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
            return '"' + s.replaceAll('"', '""') + '"';
          })
          .join(','),
      )
      .join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
