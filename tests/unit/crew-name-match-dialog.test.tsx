import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CrewNameMatchDialog } from '../../client/src/modules/crew-pool/CrewNameMatchDialog';
vi.mock('@/lib/authToken', () => ({ getAuthToken: () => 'test-token' }));
vi.mock('@/lib/tenantStorage', () => ({ getTenantId: () => 'tenant-a' }));
const fetchMock = vi.fn();
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const upload = () => fireEvent.change(screen.getByLabelText('Crew names Excel (.xlsx)'), { target: { files: [new File(['test'], 'names.xlsx')] } });
const inspected = (sheets = ['Names']) => ({ ok: true, json: async () => ({ sheets, maxRows: 10000, maxBytes: 5242880 }) });

describe('Crew Match upload dialog', () => {
  it('disables generation until a workbook and worksheet are validated', () => {
    render(<CrewNameMatchDialog isOpen onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Generate report' })).toBeDisabled();
    expect(screen.getByText(/Read-only/)).toBeInTheDocument();
  });
  it('requires a manual worksheet choice when more than one matches', async () => {
    fetchMock.mockResolvedValue(inspected(['Names', 'Other']));
    render(<CrewNameMatchDialog isOpen onClose={vi.fn()} />);
    upload();
    await screen.findByLabelText('Worksheet');
    expect(screen.getByRole('button', { name: 'Generate report' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Worksheet'), { target: { value: 'Other' } });
    expect(screen.getByRole('button', { name: 'Generate report' })).toBeEnabled();
  });
  it('sends auth and tenant headers and offers a separate downloadable Excel report', async () => {
    fetchMock.mockResolvedValueOnce(inspected()).mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['xlsx']) });
    render(<CrewNameMatchDialog isOpen onClose={vi.fn()} />);
    upload(); await screen.findByLabelText('Worksheet');
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer test-token', 'x-tenant-id': 'tenant-a', 'Content-Type': 'application/octet-stream' });
    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));
    expect(await screen.findByRole('button', { name: 'Download Excel' })).toBeEnabled();
    expect(fetchMock.mock.calls[1][0]).toContain('report?sheet=Names&filename=names.xlsx');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('shows server failures and never offers a stale report after a failed retry', async () => {
    fetchMock.mockResolvedValueOnce(inspected()).mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['xlsx']) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Database unavailable' }) });
    render(<CrewNameMatchDialog isOpen onClose={vi.fn()} />);
    upload(); await screen.findByLabelText('Worksheet');
    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));
    await screen.findByRole('button', { name: 'Download Excel' });
    fireEvent.click(screen.getByRole('button', { name: 'Generate report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
    expect(screen.queryByRole('button', { name: 'Download Excel' })).not.toBeInTheDocument();
  });
  it('locks upload/close while processing without claiming fake percentage progress', async () => {
    let resolve!: (value: any) => void;
    fetchMock.mockReturnValue(new Promise(done => { resolve = done; }));
    const close = vi.fn(); render(<CrewNameMatchDialog isOpen onClose={close} />);
    upload();
    expect(screen.getByLabelText('Crew names Excel (.xlsx)')).toBeDisabled();
    const closeButtons = screen.getAllByRole('button', { name: 'Close', exact: true });
    expect(closeButtons[0]).toBeDisabled();
    fireEvent.click(closeButtons[1]);
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Checking workbook on server');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    resolve(inspected());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Generate report' })).toBeEnabled());
    expect(close).not.toHaveBeenCalled();
  });
  it('rejects non-xlsx files without sending them', async () => {
    render(<CrewNameMatchDialog isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Crew names Excel (.xlsx)'), { target: { files: [new File(['x'], 'crew.zip')] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('standard .xlsx');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
