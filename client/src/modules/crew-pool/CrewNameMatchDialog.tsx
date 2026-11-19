import { useRef, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getAuthToken } from '@/lib/authToken';
import { getTenantId } from '@/lib/tenantStorage';

async function request(path: string, file?: File) {
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  const tenant = getTenantId();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenant) headers['x-tenant-id'] = tenant;
  if (file) headers['Content-Type'] = 'application/octet-stream';
  const response = await fetch(`/api/v2/crew-pool/crew-name-match/${path}`, {
    method: file ? 'POST' : 'GET', headers, body: file, credentials: 'include', cache: 'no-store',
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error ?? `Request failed (${response.status}). Please retry.`);
  }
  return response;
}
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CrewNameMatchDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheet, setSheet] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [report, setReport] = useState<Blob | null>(null);
  const [limits, setLimits] = useState<{ maxRows: number; maxBytes: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const run = async (message: string, action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(message); setError('');
    try { await action(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Crew matching failed. Please retry.'); }
    finally { busyRef.current = false; setBusy(''); }
  };
  const close = () => {
    if (busyRef.current) return;
    setFile(null); setSheets([]); setSheet(''); setReport(null); setError(''); setLimits(null);
    if (inputRef.current) inputRef.current.value = '';
    onClose();
  };
  const selectFile = (selected: File | null) => {
    setFile(null); setSheets([]); setSheet(''); setReport(null); setError(''); setLimits(null);
    if (!selected) return;
    if (!/\.xlsx$/i.test(selected.name)) { setError('Select a standard .xlsx workbook.'); return; }
    if (selected.size > 10 * 1024 * 1024) { setError('Workbook exceeds the maximum supported size (10 MB).'); return; }
    void run('Checking workbook on server…', async () => {
      const result = await (await request('inspect', selected)).json();
      setFile(selected); setSheets(result.sheets); setLimits(result);
      setSheet(result.sheets.length === 1 ? result.sheets[0] : '');
    });
  };
  const generate = () => {
    if (!file || !sheet) return;
    setReport(null);
    void run('Matching SAIL records and generating the report…', async () => {
      const query = new URLSearchParams({ sheet, filename: file.name });
      const blob = await (await request(`report?${query}`, file)).blob();
      setReport(blob);
    });
  };
  return <Dialog open={isOpen} onOpenChange={open => { if (!open) close(); }}>
    <DialogContent className="sm:max-w-xl" onInteractOutside={event => { if (busy) event.preventDefault(); }} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}>
      <DialogHeader>
        <DialogTitle>Crew Match</DialogTitle>
        <DialogDescription>Upload crew names to download Employee IDs and status sheets. Read-only: no crew data, folders, or attachments are changed.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <Button variant="outline" disabled={!!busy} onClick={() => void run('Preparing template…', async () => download(await (await request('template')).blob(), 'SAIL_Crew_Names_Template.xlsx'))}>
          <Download className="mr-2 h-4 w-4" />Download template
        </Button>
        <div className="space-y-2">
          <label htmlFor="crew-name-workbook" className="text-sm font-medium">Crew names Excel (.xlsx)</label>
          <Input ref={inputRef} id="crew-name-workbook" type="file" accept=".xlsx" disabled={!!busy} onChange={event => selectFile(event.target.files?.[0] ?? null)} />
          <p className="text-xs text-muted-foreground">Header in row 1: Crew Name. One name per row. Both full-name and surname-first arrangements are checked.</p>
        </div>
        {sheets.length > 0 && <div className="space-y-2">
          <label htmlFor="crew-name-sheet" className="text-sm font-medium">Worksheet</label>
          <select id="crew-name-sheet" className="w-full rounded-md border p-2 text-sm" disabled={!!busy} value={sheet} onChange={event => { setSheet(event.target.value); setReport(null); setError(''); }}>
            <option value="" disabled>Select a worksheet</option>
            {sheets.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          {limits && <p className="text-xs text-muted-foreground">Limit: {limits.maxRows.toLocaleString()} rows; {(limits.maxBytes / 1024 / 1024).toFixed(1)} MB.</p>}
        </div>}
        <p className="rounded-md bg-slate-50 p-3 text-sm">Report sheets: Active, Terminated, Not Found, Ambiguous, and Review Required, with summary and candidate details. A unique name match is not verified identity. “Not found” means no match under these name rules.</p>
        {busy && <p role="status" className="text-sm">{busy}</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {report && <p role="status" className="text-sm text-green-700">Report ready. Download the workbook to review all results.</p>}
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" disabled={!!busy} onClick={close}>Close</Button>
        <Button disabled={!!busy || !file || !sheet} onClick={generate}><Search className="mr-2 h-4 w-4" />Generate report</Button>
        {report && <Button disabled={!!busy} onClick={() => download(report, 'SAIL_Crew_Name_Match.xlsx')}><Download className="mr-2 h-4 w-4" />Download Excel</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
