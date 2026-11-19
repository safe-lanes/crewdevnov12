/** Approval notifier (who gets which email) and the approval actor (login token only). */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const sendSpy = vi.fn(async () => ({ channel: 'ses' as const }));
vi.mock('../../shared/emailService', () => ({
  sendEmailPreferSes: (...args: unknown[]) => sendSpy(...(args as [])),
  logEmailEvent: () => {},
}));
vi.mock('../roles', () => ({
  contactsForUsers: async (ids: string[]) => new Map(ids.map((id) => [id, { email: `${id}@example.com`, name: id }])),
}));
const inAppSpy = vi.fn(async (_users: string[], _n: unknown) => 1);
vi.mock('../notificationsRepository', () => ({
  insertApprovalNotifications: (users: string[], n: unknown) => inAppSpy(users, n),
}));
vi.mock('../gateway', () => ({
  getCrewingEngine: () => ({ status: async () => [{ requuid: 'q', submittedBy: 'u-sender' }] }),
  systemEngineCtx: () => ({ tenantId: 't', actor: { userId: 'system', role: null, userType: null } }),
}));
vi.mock('../../auth/roleResolutionService', () => ({
  resolveRequestRole: async () => ({ ok: true, role: { roleId: 'r1', roleName: 'Sail Admin', masterUserId: 7, masterUserType: 'office', roleType: 'Office' } }),
}));
vi.mock('../../db', () => ({
  getDb: () => ({ select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ userUuid: 'uuid-of-user-7' }] }) }) }) }),
}));

import { approvalEventNotifier } from '../notifier';
import { resolveApprovalActor } from '../actor';

const scope = { moduleId: 'crewing-sample', screenId: 'sample-request', actionId: '' };
let savedToggle: string | undefined;
beforeEach(() => { sendSpy.mockClear(); inAppSpy.mockClear(); savedToggle = process.env.APPROVAL_EMAILS_ENABLED; delete process.env.APPROVAL_EMAILS_ENABLED; });
afterEach(() => { if (savedToggle === undefined) delete process.env.APPROVAL_EMAILS_ENABLED; else process.env.APPROVAL_EMAILS_ENABLED = savedToggle; });

describe('approval notifier', () => {
  it('emails each approver of a newly active step', async () => {
    approvalEventNotifier({ type: 'step-activated', tenantId: 't', requuid: 'q', scope, subjectRef: 'R1', nodeKey: 'step-1', approverUserIds: ['u1', 'u2'] });
    await vi.waitFor(() => expect(sendSpy).toHaveBeenCalledTimes(2));
    const recipients = sendSpy.mock.calls.map((c) => (c as unknown[])[0]);
    expect(recipients).toEqual([['u1@example.com'], ['u2@example.com']]);
    expect((sendSpy.mock.calls[0] as unknown[])[1]).toMatch(/^Approval needed:/);
  });

  it('tells the submitter when the request is returned, with the remarks', async () => {
    approvalEventNotifier({ type: 'request-returned', tenantId: 't', requuid: 'q', scope, subjectRef: 'R1', returnedBy: 'u1', remarks: 'missing receipts' });
    await vi.waitFor(() => expect(sendSpy).toHaveBeenCalledTimes(1));
    const [to, subject, html] = sendSpy.mock.calls[0] as unknown as [string[], string, string];
    expect(to).toEqual(['u-sender@example.com']);
    expect(subject).toMatch(/^Returned:/);
    expect(html).toContain('missing receipts');
  });

  it('emails off: no email, but the in-app notification is still created', async () => {
    process.env.APPROVAL_EMAILS_ENABLED = 'false';
    approvalEventNotifier({ type: 'step-activated', tenantId: 't', requuid: 'q', scope, subjectRef: 'R1', nodeKey: 'step-1', approverUserIds: ['u1'] });
    await vi.waitFor(() => expect(inAppSpy).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 30));
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('in-app: approvers of the new step only, one row per step', async () => {
    approvalEventNotifier({ type: 'step-activated', tenantId: 't', requuid: 'q', scope, subjectRef: 'R1', nodeKey: 'step-2', approverUserIds: ['u-master'] });
    await vi.waitFor(() => expect(inAppSpy).toHaveBeenCalledTimes(1));
    const [users, n] = inAppSpy.mock.calls[0] as unknown as [string[], { kind: string; nodeKey: string; requuid: string; title: string }];
    expect(users).toEqual(['u-master']);
    expect(n).toMatchObject({ kind: 'pending', nodeKey: 'step-2', requuid: 'q' });
    expect(n.title).toMatch(/^Approval needed:/);
  });

  it('in-app: the submitter only, when the request is approved', async () => {
    approvalEventNotifier({ type: 'request-completed', tenantId: 't', requuid: 'q', scope, subjectRef: 'R1' });
    await vi.waitFor(() => expect(inAppSpy).toHaveBeenCalledTimes(1));
    const [users, n] = inAppSpy.mock.calls[0] as unknown as [string[], { kind: string }];
    expect(users).toEqual(['u-sender']);
    expect(n.kind).toBe('approved');
  });
});

describe('approval actor comes from the login token only', () => {
  it('uses the JWT user and ignores ids in the request body', async () => {
    const req = { user: { id: 7, userType: 'Office' }, body: { userId: 'attacker', userUuid: 'attacker', role: 'Super Admin' } } as never;
    expect(await resolveApprovalActor(req)).toEqual({ userId: 'uuid-of-user-7', role: 'Sail Admin', userType: 'Office', isAdmin: true });
  });

  it('no signed-in user → no actor', async () => {
    expect(await resolveApprovalActor({ body: { userId: 'attacker' } } as never)).toBeNull();
  });
});
