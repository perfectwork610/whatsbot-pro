export function parseCSV(input: string): Record<string, string>[] {
  const source = input.replace(/^\uFEFF/, '');
  const delimiter = source.split(/\r?\n/)[0].includes(';') ? ';' : ',';
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
  const headers = rows.shift()?.map((h) => h.toLowerCase()) || [];
  if (!headers.some((h) => ['phone', 'telefone', 'numero', 'número'].includes(h)))
    throw new Error('CSV precisa da coluna telefone (com código do país).');
  return rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] || ''])));
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
