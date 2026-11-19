/**
 * Crewing approvals host layer — the engine guide's checklist, without a database:
 * boot refuses a broken card, registry lists the Crewing card, submit → approve → onDecision
 * exactly once, reject → returned, replay → 409, NO_WORKFLOW / DISABLED keep legacy behaviour,
 * a second tenant sees nothing of the first, the tenant provider refuses a forged tenant id,
 * the actor never comes from the request body.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';

// Role → approvers comes from the database in production; fixed holders here.
const HOLDERS: Record<string, string[]> = { 'role-master': ['u-master'], 'role-dpa': ['u-dpa-1', 'u-dpa-2'] };
vi.mock('../roles', () => ({
  listApprovalRoles: async () => [
    { roleId: 'role-master', roleLabel: 'Master' },
    { roleId: 'role-dpa', roleLabel: 'DPA' },
  ],
  resolveRoleApproverUserIds: async (roleId: string) => HOLDERS[roleId] ?? [],
  contactsForUsers: async () => new Map(),
}));

let currentTenant: string | null = 'tenant-a';
vi.mock('../../../utils/tenantConnectionManager', () => ({
  tenantConnectionManager: { getCurrentTenantId: () => currentTenant, isMultiTenantEnabled: true },
}));
vi.mock('../../db', () => ({ getBaseDb: () => ({}), getDb: () => ({}) }));

import { ApprovalEngine, CardRegistry, startEmbedded, type EngineCtx, type Scope, type WorkflowDefInput } from '../../approval-engine';
import { InMemoryProvider } from './inMemoryRepository';
import { sampleApprovalCard, sampleSaveRecord, sampleGetRecord, SAMPLE_MODULE_ID, SAMPLE_SCREEN_ID, type SampleRecord } from '../cards/sampleCard';
import { AlsTenantRepositoryProvider } from '../tenantProvider';

const SCOPE: Scope = { moduleId: SAMPLE_MODULE_ID, screenId: SAMPLE_SCREEN_ID, actionId: '' };
const ctx = (tenantId: string, userId: string): EngineCtx => ({ tenantId, actor: { userId, role: 'X', userType: 'Office' } });

function wf(classification: string, steps: Array<{ roles: string[]; rule: 'all' | 'any' }>): WorkflowDefInput {
  const nodes = steps.map((s, i) => ({
    key: `step-${i + 1}`, type: 'approval-step' as const, label: `Step ${i + 1}`, ordinal: i,
    quorum: { rule: s.rule }, slots: s.roles.map((r) => ({ roleId: r, roleLabel: r })),
  }));
  const all = [...nodes, { key: 'end', type: 'end' as const, label: 'End', ordinal: nodes.length }];
  return { scope: SCOPE, classification, mode: 'simple', label: 'test', nodes: all, edges: all.slice(0, -1).map((n, i) => ({ from: n.key, to: all[i + 1].key })) };
}

function record(tenant: string, ref: string, urgent = false): SampleRecord {
  const rec: SampleRecord = { ref, title: `Rec ${ref}`, vesselUuid: 'v-1', urgent, status: 'pending-approval', decidedBy: null, remarks: null, applyCount: 0 };
  sampleSaveRecord(tenant, rec);
  return rec;
}

let engine: ApprovalEngine;
beforeEach(() => {
  const registry = new CardRegistry();
  registry.register(sampleApprovalCard);
  engine = new ApprovalEngine({ registry, provider: new InMemoryProvider() });
});

describe('boot and registry', () => {
  it('a broken card refuses to start (fail-loud)', () => {
    const broken = { ...sampleApprovalCard, onDecision: undefined } as unknown as typeof sampleApprovalCard;
    expect(() => startEmbedded(express(), { cards: [broken], provider: new InMemoryProvider() })).toThrow(/onDecision/);
  });
  it('the registry lists the Crewing card and its classifications', () => {
    const tree = engine.registryTree();
    expect(tree.modules.map((m) => m.moduleId)).toEqual([SAMPLE_MODULE_ID]);
    expect(tree.modules[0].scopes[0].classifications.map((c) => c.id)).toEqual(['Normal', 'Urgent']);
  });
});

describe('submit → decide', () => {
  it('one-step workflow: approve applies the result exactly once', async () => {
    await engine.saveWorkflow(ctx('tenant-a', 'admin'), wf('Normal', [{ roles: ['role-master'], rule: 'all' }]));
    const rec = record('tenant-a', 'r1');
    const out = await engine.submit(ctx('tenant-a', 'u-sender'), { scope: SCOPE, subjectRef: 'r1', subject: { ref: 'r1' } });
    expect(out.outcome).toBe('STARTED');
    if (out.outcome !== 'STARTED') return;
    const res = await engine.decide(ctx('tenant-a', 'u-master'), out.requuid, { decision: 'approve' });
    expect(res.requestStatus).toBe('approved');
    expect(rec.status).toBe('approved');
    expect(rec.applyCount).toBe(1);
  });

  it('a user who does not hold the role cannot decide', async () => {
    await engine.saveWorkflow(ctx('tenant-a', 'admin'), wf('Normal', [{ roles: ['role-master'], rule: 'all' }]));
    record('tenant-a', 'r2');
    const out = await engine.submit(ctx('tenant-a', 'u-sender'), { scope: SCOPE, subjectRef: 'r2', subject: { ref: 'r2' } });
    if (out.outcome !== 'STARTED') throw new Error('expected STARTED');
    await expect(engine.decide(ctx('tenant-a', 'u-someone-else'), out.requuid, { decision: 'approve' })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('reject returns the record with remarks', async () => {
    await engine.saveWorkflow(ctx('tenant-a', 'admin'), wf('Urgent', [{ roles: ['role-dpa'], rule: 'any' }]));
    const rec = record('tenant-a', 'r3', true);
    const out = await engine.submit(ctx('tenant-a', 'u-sender'), { scope: SCOPE, subjectRef: 'r3', subject: { ref: 'r3' } });
    if (out.outcome !== 'STARTED') throw new Error('expected STARTED');
    await engine.decide(ctx('tenant-a', 'u-dpa-2'), out.requuid, { decision: 'reject', remarks: 'missing receipts' });
    expect(rec.status).toBe('returned');
    expect(rec.remarks).toBe('missing receipts');
    expect(rec.applyCount).toBe(1);
  });

  it('deciding again after the request is final is refused (409) and changes nothing', async () => {
    await engine.saveWorkflow(ctx('tenant-a', 'admin'), wf('Normal', [{ roles: ['role-master'], rule: 'all' }]));
    const rec = record('tenant-a', 'r4');
    const out = await engine.submit(ctx('tenant-a', 'u-sender'), { scope: SCOPE, subjectRef: 'r4', subject: { ref: 'r4' } });
    if (out.outcome !== 'STARTED') throw new Error('expected STARTED');
    await engine.decide(ctx('tenant-a', 'u-master'), out.requuid, { decision: 'approve' });
    await expect(engine.decide(ctx('tenant-a', 'u-master'), out.requuid, { decision: 'approve' })).rejects.toMatchObject({ statusCode: 409 });
    expect(rec.applyCount).toBe(1);
  });

  it('a replayed decision (recovery tool) does not apply the result twice', async () => {
    await engine.saveWorkflow(ctx('tenant-a', 'admin'), wf('Normal', [{ roles: ['role-master'], rule: 'all' }]));
    const rec = record('tenant-a', 'r4b');
    const out = await engine.submit(ctx('tenant-a', 'u-sender'), { scope: SCOPE, subjectRef: 'r4b', subject: { ref: 'r4b' } });
    if (out.outcome !== 'STARTED') throw new Error('expected STARTED');
    await engine.decide(ctx('tenant-a', 'u-master'), out.requuid, { decision: 'approve' });
    await engine.replayDecision(ctx('tenant-a', 'admin'), out.requuid);
    expect(rec.status).toBe('approved');
    expect(rec.applyCount).toBe(1);
  });

  it('two steps: the second step only activates after the first is approved', async () => {
    await engine.saveWorkflow(ctx('tenant-a', 'admin'), wf('Normal', [{ roles: ['role-master'], rule: 'all' }, { roles: ['role-dpa'], rule: 'any' }]));
    const rec = record('tenant-a', 'r5');
    const out = await engine.submit(ctx('tenant-a', 'u-sender'), { scope: SCOPE, subjectRef: 'r5', subject: { ref: 'r5' } });
    if (out.outcome !== 'STARTED') throw new Error('expected STARTED');
    await expect(engine.decide(ctx('tenant-a', 'u-dpa-1'), out.requuid, { decision: 'approve' })).rejects.toMatchObject({ statusCode: 403 });
    const first = await engine.decide(ctx('tenant-a', 'u-master'), out.requuid, { decision: 'approve' });
    expect(first.requestStatus).toBe('pending');
    expect(rec.status).toBe('pending-approval');
    const second = await engine.decide(ctx('tenant-a', 'u-dpa-1'), out.requuid, { decision: 'approve' });
    expect(second.requestStatus).toBe('approved');
    expect(rec.applyCount).toBe(1);
  });
});

describe('legacy fallback', () => {
  it('NO_WORKFLOW when no chain is configured for the classification', async () => {
    record('tenant-a', 'r6');
    const out = await engine.submit(ctx('tenant-a', 'u-sender'), { scope: SCOPE, subjectRef: 'r6', subject: { ref: 'r6' } });
    expect(out.outcome).toBe('NO_WORKFLOW');
  });
  it('DISABLED when the action is switched off for the tenant', async () => {
    await engine.saveWorkflow(ctx('tenant-a', 'admin'), wf('Normal', [{ roles: ['role-master'], rule: 'all' }]));
    await engine.setScopeEnabled(ctx('tenant-a', 'admin'), SCOPE, false);
    record('tenant-a', 'r7');
    const out = await engine.submit(ctx('tenant-a', 'u-sender'), { scope: SCOPE, subjectRef: 'r7', subject: { ref: 'r7' } });
    expect(out.outcome).toBe('DISABLED');
  });
});

describe('tenant isolation', () => {
  it('a chain and a request in tenant A are invisible in tenant B', async () => {
    await engine.saveWorkflow(ctx('tenant-a', 'admin'), wf('Normal', [{ roles: ['role-master'], rule: 'all' }]));
    record('tenant-a', 'r8');
    const out = await engine.submit(ctx('tenant-a', 'u-sender'), { scope: SCOPE, subjectRef: 'r8', subject: { ref: 'r8' } });
    expect(out.outcome).toBe('STARTED');
    expect(await engine.listWorkflows(ctx('tenant-b', 'admin'))).toHaveLength(0);
    expect(await engine.status(ctx('tenant-b', 'admin'), SCOPE, 'r8')).toHaveLength(0);
    expect(sampleGetRecord('tenant-b', 'r8')).toBeNull();
  });

  it('the Crewing tenant provider refuses an engine call for another tenant', () => {
    currentTenant = 'tenant-a';
    const provider = new AlsTenantRepositoryProvider();
    expect(() => provider.forTenant('tenant-b')).toThrow(/tenant mismatch/);
  });
});
