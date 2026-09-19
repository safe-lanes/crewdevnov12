import { describe, it, expect, vi } from 'vitest';
import {
  D3_HYDRATION_COMMIT,
  createD3Session,
  createD3CreateRegistry,
  loadD3Handoff,
} from '../../client/src/modules/crew-pool/utils/d3MatrixDefaults';

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>(done => {
    resolve = done;
  });

  return { promise, resolve };
}

describe('D3 first-create coordination', () => {
  it('waits for outstanding creation before loading another profile', async () => {
    const registry = createD3CreateRegistry();
    const ticket = registry.begin();
    const load = vi.fn(async () => ({ id: 'B' }));

    const result = loadD3Handoff(registry, 'B', () => true, load);

    await Promise.resolve();
    expect(load).not.toHaveBeenCalled();

    ticket.finish();

    await expect(result).resolves.toEqual({
      profile: { id: 'B' },
    });

    expect(load).toHaveBeenCalledExactlyOnceWith('B');
  });

  it('keeps pending work visible to another form instance', async () => {
    const registry = createD3CreateRegistry();
    const ticket = registry.begin();

    expect(registry.pending()).toHaveLength(1);

    const newInstanceLoad = loadD3Handoff(
      registry,
      'B',
      () => true,
      async () => ({ id: 'B' }),
    );

    ticket.finish();

    await expect(newInstanceLoad).resolves.toEqual({
      profile: { id: 'B' },
    });

    expect(registry.pending()).toHaveLength(0);
  });

  it('finishing an old ticket cannot release a newer ticket', () => {
    const registry = createD3CreateRegistry();
    const first = registry.begin();
    const second = registry.begin();

    first.finish();
    first.finish();

    expect(registry.pending()).toEqual([second.completion]);

    second.finish();

    expect(registry.pending()).toHaveLength(0);
  });

  it('does not start a read for a superseded session', async () => {
    const registry = createD3CreateRegistry();
    const ticket = registry.begin();
    const load = vi.fn(async () => ({ id: 'B' }));
    let current = true;

    const result = loadD3Handoff(
      registry,
      'B',
      () => current,
      load,
    );

    current = false;
    ticket.finish();

    await expect(result).resolves.toBeUndefined();
    expect(load).not.toHaveBeenCalled();
  });

  it('does not accept a profile returned after another crew is selected', async () => {
    const registry = createD3CreateRegistry();
    const response = deferred<{ id: string }>();
    let current = true;

    const result = loadD3Handoff(
      registry,
      'B',
      () => current,
      () => response.promise,
    );

    await Promise.resolve();
    current = false;
    response.resolve({ id: 'B' });

    await expect(result).resolves.toBeUndefined();
  });

  it('rejects a profile with the wrong crew identity', async () => {
    const registry = createD3CreateRegistry();

    await expect(
      loadD3Handoff(
        registry,
        'B',
        () => true,
        async () => ({ id: 'A' }),
      ),
    ).rejects.toThrow('does not match the selected crew');
  });

  it('propagates load failure and permits an explicit retry', async () => {
    const registry = createD3CreateRegistry();

    await expect(
      loadD3Handoff(
        registry,
        'B',
        () => true,
        async () => {
          throw new Error('Network failure');
        },
      ),
    ).rejects.toThrow('Network failure');

    await expect(
      loadD3Handoff(
        registry,
        'B',
        () => true,
        async () => ({ id: 'B' }),
      ),
    ).resolves.toEqual({ profile: { id: 'B' } });
  });

  it('waits before allowing a new-crew blank reset', async () => {
    const registry = createD3CreateRegistry();
    const ticket = registry.begin();
    const load = vi.fn(async () => ({ id: 'unused' }));

    const result = loadD3Handoff(
      registry,
      null,
      () => true,
      load,
    );

    ticket.finish();

    await expect(result).resolves.toEqual({ profile: null });
    expect(load).not.toHaveBeenCalled();
  });

  it('loads the newly created crew only after its training work settles', async () => {
    const registry = createD3CreateRegistry();
    const ticket = registry.begin();

    const savedTraining: string[] = [];
    const load = vi.fn(async () => ({
      id: 'A',
      trainingCourses: [...savedTraining],
    }));

    const result = loadD3Handoff(
      registry,
      'A',
      () => true,
      load,
    );

    savedTraining.push('saved-training-uuid');
    ticket.finish();

    await expect(result).resolves.toEqual({
      profile: {
        id: 'A',
        trainingCourses: ['saved-training-uuid'],
      },
    });
  });

  it('uses distinct sessions and suppression sets when reopening', () => {
    const first = createD3Session(true, 'A');
    first.suppressed.add('COURSE-A');
    first.open = false;

    const reopened = createD3Session(true, 'A');

    expect(reopened).not.toBe(first);
    expect(reopened.prefix).not.toBe(first.prefix);
    expect(reopened.suppressed.size).toBe(0);
  });

  it('requires the exact committed hydration token, not just profile identity', () => {
    const oldToken = {};
    const nextToken = {};

    const previousForm = {
      firstName: 'A',
      [D3_HYDRATION_COMMIT]: oldToken,
    };

    expect(previousForm[D3_HYDRATION_COMMIT]).not.toBe(nextToken);

    const hydratedForm = {
      firstName: 'B',
      [D3_HYDRATION_COMMIT]: nextToken,
    };

    expect(hydratedForm[D3_HYDRATION_COMMIT]).toBe(nextToken);
    expect(JSON.stringify(hydratedForm)).toBe('{"firstName":"B"}');
  });
});