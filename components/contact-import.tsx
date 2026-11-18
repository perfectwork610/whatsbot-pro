'use client';
import { useState, type FormEvent } from 'react';
import { Download, LoaderCircle, Upload } from 'lucide-react';
import { csvDownload, parseContactList, type ImportedContact } from '@/lib/csv';
import { parseContactSpreadsheet } from '@/lib/xlsx-contacts';
import { useLanguage } from './language';
import { Button } from './workspace-ui';

const MAX_BYTES = 5_000_000;

export default function ContactImport({
  busy,
  progress,
  onImport,
  onError,
}: {
  busy: boolean;
  progress: { processed: number; total: number } | null;
  onImport: (rows: ImportedContact[]) => Promise<void>;
  onError: (message: string) => void;
}) {
  const { t, locale } = useLanguage();
  const [content, setContent] = useState('');
  const [spreadsheetRows, setSpreadsheetRows] = useState<ImportedContact[] | null>(null);
  const [fileLabel, setFileLabel] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const rows = spreadsheetRows ?? parseContactList(content);
      if (!rows.length) throw new Error('A lista está vazia. Adicione pelo menos um telefone.');
      if (rows.length > 100000) throw new Error('Importe até 100.000 contatos por arquivo.');
      void onImport(rows);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Falha na operação');
    }
  }
  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-xs leading-6 text-emerald-800">
        <Upload size={18} className="mb-2" />
        {t(
          'Importe XLSX de prospecção (EMPRESA, TELEFONE…) ou CSV/TXT com um telefone por linha.',
        )}
      </div>
      <p className="text-xs leading-6 text-slate-500">
        {t(
          'Na planilha XLSX, o nome usa NOME FANTASIA ou EMPRESA e o telefone recebe o código do Brasil (55) quando necessário. Contatos importados ficam com permissão pendente.',
        )}
      </p>
      <Button
        secondary
        disabled={busy}
        onClick={() =>
          csvDownload(locale === 'en' ? 'phone-list-example.csv' : 'exemplo-telefones.csv', [
            ['5511999999999'],
            ['5521999999999'],
          ])
        }
      >
        <Download size={14} />
        {t('Baixar modelo')}
      </Button>
      <input
        aria-label={t('Arquivo CSV, TXT ou XLSX')}
        type="file"
        accept=".csv,.txt,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={busy}
        className="block w-full text-sm"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            if (file.size > MAX_BYTES) throw new Error('Máximo de 5 MB.');
            const lower = file.name.toLowerCase();
            if (lower.endsWith('.xlsx')) {
              const rows = parseContactSpreadsheet(await file.arrayBuffer());
              setSpreadsheetRows(rows);
              setContent('');
              setFileLabel(`${file.name} · ${rows.length}`);
              onError('');
              return;
            }
            setSpreadsheetRows(null);
            setFileLabel('');
            setContent(await file.text());
            onError('');
          } catch (error) {
            setSpreadsheetRows(null);
            setFileLabel('');
            setContent('');
            event.target.value = '';
            onError(error instanceof Error ? error.message : 'Falha na operação');
          }
        }}
      />
      {spreadsheetRows ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600">
          <p className="font-semibold text-slate-800">{fileLabel} {t('contatos prontos')}</p>
          <p className="mt-2">
            {t('Exemplo:')} {spreadsheetRows[0]?.name} · +{spreadsheetRows[0]?.phone}
          </p>
        </div>
      ) : (
        <textarea
          aria-label={t('Lista de telefones ou conteúdo CSV')}
          value={content}
          disabled={busy}
          onChange={(event) => {
            setContent(event.target.value);
            setSpreadsheetRows(null);
            setFileLabel('');
          }}
          className="workspace-input w-full font-mono text-xs"
          rows={7}
          placeholder={'5511999999999\n5521999999999\n'}
        />
      )}
      <p className="text-[10px] leading-5 text-slate-400">
        {t(
          'Até 5 MB e 100.000 contatos por arquivo. Listas grandes são importadas em lotes; duplicados são ignorados. XLSX de prospecção e CSV/TXT continuam aceitos.',
        )}
      </p>
      {progress && (
        <div role="status" aria-live="polite" className="space-y-2">
          <p className="text-xs text-emerald-700">
            {t(busy ? 'Importando contatos…' : 'Importação interrompida')}{' '}
            {progress.processed.toLocaleString(locale)} / {progress.total.toLocaleString(locale)}
          </p>
          <progress
            aria-label={t('Progresso da importação')}
            value={progress.processed}
            max={progress.total}
            className="h-2 w-full accent-emerald-600"
          />
        </div>
      )}
      {progress && !busy && (
        <p className="text-xs leading-6 text-amber-700">
          {t('Os lotes já salvos foram mantidos. Tente novamente; os duplicados serão ignorados.')}
        </p>
      )}
      <Button type="submit" disabled={busy || (!content.trim() && !spreadsheetRows?.length)}>
        {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Upload size={16} />}{' '}
        {t('Validar e importar')}
      </Button>
    </form>
  );
}
