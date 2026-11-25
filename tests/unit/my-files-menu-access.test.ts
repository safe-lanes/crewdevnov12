import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMyFilesView } from '../../client/src/hooks/useMyFilesAccess';

// The My Files menu entry is shown only when the My Files server says the role may view it for the module.
describe('fetchMyFilesView', () => {
  afterEach(() => vi.unstubAllGlobals());

  const answer = (status: number, body: unknown) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

  it('asks My Files for this module with the login token', async () => {
    const fetchMock = answer(200, { statusCode: 200, data: { view: true } });
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchMyFilesView('Crewing', 'tok')).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/m/api/v1/modules-access/me?moduleCode=Crewing');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('hides the entry when the role has no View permission', async () => {
    vi.stubGlobal('fetch', answer(200, { statusCode: 200, data: { view: false, create: true } }));
    expect(await fetchMyFilesView('Crewing', 'tok')).toBe(false);
  });

  it('hides the entry when My Files refuses, does not know the module, or is down', async () => {
    vi.stubGlobal('fetch', answer(401, { message: 'Please log in again' }));
    expect(await fetchMyFilesView('Crewing', 'tok')).toBe(false);
    vi.stubGlobal('fetch', answer(404, { message: 'Module not found' }));
    expect(await fetchMyFilesView('Crewing', 'tok')).toBe(false);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    expect(await fetchMyFilesView('Crewing', 'tok')).toBe(false);
  });

  it('does not call the server without a token', async () => {
    const fetchMock = answer(200, { data: { view: true } });
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchMyFilesView('Crewing', null)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts only a real true', async () => {
    vi.stubGlobal('fetch', answer(200, { data: { view: 1 } }));
    expect(await fetchMyFilesView('Crewing', 'tok')).toBe(false);
  });
});
