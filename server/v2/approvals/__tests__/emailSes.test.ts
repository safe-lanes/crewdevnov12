/** SES option in Crewing's email service. The AWS call and the backoff wait are replaced. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('googleapis', () => ({
  google: { auth: { OAuth2: class { setCredentials() {} } }, gmail: () => ({ users: { messages: { send: async () => ({}) } } }) },
}));

import * as email from '../../shared/emailService';

const SES_VARS = ['APPROVAL_SMTP_JSON', 'AWS_SES_REGION', 'APPROVAL_SES_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'APPROVAL_EMAIL_FROM', 'SUPPORT_EMAIL'];
let saved: Record<string, string | undefined> = {};
beforeEach(() => {
  saved = Object.fromEntries(SES_VARS.map((k) => [k, process.env[k]]));
  for (const k of SES_VARS) delete process.env[k];
  email.__setSesWaitForTests(async () => {});
});
afterEach(() => {
  for (const k of SES_VARS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  email.__setSesSendForTests(null);
  email.__setSesWaitForTests(null);
});

function setLiveSes() {
  process.env.AWS_SES_REGION = 'ap-southeast-1';
  process.env.AWS_ACCESS_KEY_ID = 'test-id';
  process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
  process.env.APPROVAL_EMAIL_FROM = 'approvals@example.com';
}

describe('SES option in emailService', () => {
  it('is off unless every shared SES variable is set', () => {
    expect(email.sesConfig()).toBeNull();
    process.env.AWS_SES_REGION = 'ap-southeast-1';
    process.env.APPROVAL_EMAIL_FROM = 'approvals@example.com';
    expect(email.sesConfig()).toBeNull(); // keys missing
    setLiveSes();
    expect(email.sesConfig()).toEqual({ region: 'ap-southeast-1', from: 'approvals@example.com', mode: 'live' });
  });

  it('SUPPORT_EMAIL is the sender when APPROVAL_EMAIL_FROM is not set; APPROVAL_SES_REGION wins', () => {
    setLiveSes();
    delete process.env.APPROVAL_EMAIL_FROM;
    process.env.SUPPORT_EMAIL = 'support@example.com';
    process.env.APPROVAL_SES_REGION = 'eu-west-1';
    expect(email.sesConfig()).toMatchObject({ from: 'support@example.com', region: 'eu-west-1' });
  });

  it('test mode (APPROVAL_SMTP_JSON=1) never calls AWS', async () => {
    process.env.APPROVAL_SMTP_JSON = '1';
    const send = vi.fn(async () => 'never');
    email.__setSesSendForTests(send);
    expect(await email.sendEmailPreferSes(['a@example.com'], 'S', '<p>x</p>')).toEqual({ channel: 'ses' });
    expect(send).not.toHaveBeenCalled();
  });

  it('retries a throttled send, then succeeds', async () => {
    setLiveSes();
    const send = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('slow down'), { name: 'ThrottlingException' }))
      .mockResolvedValueOnce('msg-1');
    email.__setSesSendForTests(send);
    expect(await email.sendEmailPreferSes(['a@example.com'], 'S', '<p>x</p>')).toEqual({ channel: 'ses' });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('does not retry a permanent rejection and reports the error without throwing', async () => {
    setLiveSes();
    const send = vi.fn().mockRejectedValue(Object.assign(new Error('bad sender'), { name: 'MessageRejected' }));
    email.__setSesSendForTests(send);
    const out = await email.sendEmailPreferSes(['a@example.com'], 'S', '<p>x</p>');
    expect(out.channel).toBe('ses');
    expect(out.error).toMatch(/bad sender/);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('never sends to a malformed address', async () => {
    setLiveSes();
    const send = vi.fn(async () => 'x');
    email.__setSesSendForTests(send);
    expect(await email.sendEmailPreferSes(['not-an-address'], 'S', '<p>x</p>')).toEqual({ channel: 'none', error: 'no valid recipient address' });
    expect(send).not.toHaveBeenCalled();
  });
});
