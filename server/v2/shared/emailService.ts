import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';


// Local Gmail configuration (Primary)
const GMAIL_SUPPORT_EMAIL = process.env.GMAIL_SUPPORT_EMAIL;
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

// External Socket Server configuration (Fallback)
const EMAIL_API_URL = process.env.EMAIL_API_URL;
const EMAIL_CC = process.env.EMAIL_CC;


const LOG_DIR = path.join(process.cwd(), 'logs', 'email');
const LOG_FILE = path.join(LOG_DIR, 'email.log');

/**
 * Robust file logging helper. Appends standard formatted logs to logs/email/email.log
 */
export function logEmailEvent(level: 'INFO' | 'WARN' | 'ERROR', message: string, details?: any) {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    const timestamp = new Date().toISOString();
    const detailsStr = details 
      ? ` | Details: ${typeof details === 'object' ? JSON.stringify(details) : details}` 
      : '';
    const logEntry = `[${timestamp}] [${level}] ${message}${detailsStr}\n`;
    fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
    
    // Also mirror to console for developer convenience
    console.log(`[${level}] ${message}${detailsStr}`);
  } catch (err) {
    console.error('Failed to write to email log file:', err);
  }
}

// Log presence only: never credentials, credential prefixes or endpoints.
logEmailEvent('INFO', 'EmailService Initializing', {
  gmailConfigured: Boolean(GMAIL_SUPPORT_EMAIL && GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN),
  externalServiceConfigured: Boolean(EMAIL_API_URL),
  ccConfigured: Boolean(EMAIL_CC),
});


const oAuth2Client = new google.auth.OAuth2(
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);

if (GMAIL_REFRESH_TOKEN) {
  oAuth2Client.setCredentials({
    refresh_token: GMAIL_REFRESH_TOKEN,
  });
}

const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

/**
 * Refreshes the Gmail OAuth2 credentials access token if it's expired or about to expire.
 */
async function refreshAccessToken(): Promise<string | null | undefined> {
  logEmailEvent('INFO', 'refreshAccessToken started.');
  try {
    const currentCredentials = oAuth2Client.credentials;
    if (currentCredentials.expiry_date && currentCredentials.expiry_date > Date.now()) {
      logEmailEvent('INFO', `Current access token is still valid. Expiry: ${currentCredentials.expiry_date}`);
      return currentCredentials.access_token;
    }
    
    logEmailEvent('INFO', 'Access token expired or missing. Refreshing token...');
    const { token } = await oAuth2Client.getAccessToken();
    logEmailEvent('INFO', 'New access token fetched successfully.');
    oAuth2Client.setCredentials({
      access_token: process.env.ACCESS_TOKEN || token || undefined,
      refresh_token: GMAIL_REFRESH_TOKEN,
    });
    return token;
  } catch (error: any) {
    logEmailEvent('ERROR', 'Error refreshing access token', error.message || error);
    throw error;
  }
}

/**
 * Sends an email using local Gmail API via Google APIs Client.
 */
async function sendViaLocalGmail(
  to: string[],
  subject: string,
  htmlBody: string,
  cc?: string[],
  bcc?: string[]
): Promise<void> {
  logEmailEvent('INFO', 'sendViaLocalGmail called with parameters', { to, subject });
  await refreshAccessToken();
  logEmailEvent('INFO', 'Access token verification complete.');

  const extraHeaders: string[] = [];
  if (cc && cc.length > 0) {
    extraHeaders.push(`Cc: ${cc.join(', ')}`);
  }
  if (bcc && bcc.length > 0) {
    extraHeaders.push(`Bcc: ${bcc.join(', ')}`);
  }

  // Gmail API requires raw MIME email formatted as RFC 2822
  for (const recipient of to) {
    logEmailEvent('INFO', `Formatting MIME message for recipient: ${recipient}`);
    const emailParts = [
      'Content-Type: text/html; charset="UTF-8"',
      'MIME-Version: 1.0',
      'Content-Transfer-Encoding: 7bit',
      `To: ${recipient}`,
      `From: ${GMAIL_SUPPORT_EMAIL}`,
      `Subject: ${subject}`,
      ...extraHeaders,
      '',
      htmlBody,
    ];

    const emailData = emailParts.join('\n');
    const encodedEmail = Buffer.from(emailData)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    logEmailEvent('INFO', 'Sending raw payload to Gmail API...');
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
      },
    });
    logEmailEvent('INFO', `Email successfully sent directly via local Gmail API to ${recipient}`);
  }
}

/**
 * Sends an email using the external Socket Server API as a fallback.
 */
async function sendViaExternalApi(
  to: string[],
  subject: string,
  htmlBody: string,
  cc?: string[],
  bcc?: string[]
): Promise<void> {
  logEmailEvent('INFO', 'sendViaExternalApi called', { to, subject });

  if (!EMAIL_API_URL) {
    logEmailEvent('WARN', 'External API send aborted: EMAIL_API_URL is not defined in environment variables.');
    throw new Error('EMAIL_API_URL is not defined');
  }

  const payload = {
    emails: to,
    subject: subject,
    body: htmlBody,
    cc: cc || null,
    bcc: bcc || null,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds timeout

  try {
    const response = await fetch(EMAIL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });


    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`External API responded with status ${response.status}`);
    }

    const result = await response.json();
    logEmailEvent('INFO', 'Email successfully triggered via external API.', result);
  } catch (error: any) {
    clearTimeout(timeoutId);
    logEmailEvent('ERROR', 'External API send failed.', error.message || error);
    throw error;
  }
}

// ── Amazon SES (SESv2) option ──────────────────────────────────────────────
// Added 17-Nov-2026 for approval emails. Uses the SAME SES variable names as the other SAIL
// modules (one set of values for the whole package; set per server, never in the repo):
//   AWS_SES_REGION (or APPROVAL_SES_REGION), AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
//   APPROVAL_EMAIL_FROM (or SUPPORT_EMAIL) = the verified sender.
// APPROVAL_SMTP_JSON=1 = test mode: the send is logged as JSON, nothing reaches AWS.
// The existing sendEmail() below (external relay, then Gmail) is NOT changed.

export interface SesConfig {
  region: string;
  from: string;
  mode: 'live' | 'json-test';
}

/** SES settings from the environment, or null when they are not all set. */
export function sesConfig(): SesConfig | null {
  const from = process.env.APPROVAL_EMAIL_FROM || process.env.SUPPORT_EMAIL;
  if (process.env.APPROVAL_SMTP_JSON === '1') {
    return { region: 'json-test', from: from || 'approvals@test.local', mode: 'json-test' };
  }
  const region = process.env.APPROVAL_SES_REGION || process.env.AWS_SES_REGION;
  if (!region || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !from) return null;
  return { region, from, mode: 'live' };
}

/** SES errors that can never succeed on retry. */
const SES_PERMANENT_ERRORS = new Set([
  'MessageRejected',
  'MailFromDomainNotVerifiedException',
  'AccountSuspendedException',
  'SendingPausedException',
]);
const SES_MAX_ATTEMPTS = 3;
const SES_BASE_BACKOFF_MS = 400;

type SesSend = (input: { region: string; from: string; to: string[]; subject: string; html: string }) => Promise<string>;

let sesClientCache: { region: string; client: unknown } | null = null;

const defaultSesSend: SesSend = async ({ region, from, to, subject, html }) => {
  const { SESv2Client, SendEmailCommand } = await import('@aws-sdk/client-sesv2');
  if (!sesClientCache || sesClientCache.region !== region) {
    // Credentials come from the SDK's standard environment chain (checked in sesConfig()).
    sesClientCache = { region, client: new SESv2Client({ region }) };
  }
  const client = sesClientCache.client as InstanceType<typeof SESv2Client>;
  const out = await client.send(new SendEmailCommand({
    FromEmailAddress: from,
    Destination: { ToAddresses: to },
    Content: { Simple: { Subject: { Data: subject, Charset: 'UTF-8' }, Body: { Html: { Data: html, Charset: 'UTF-8' } } } },
  }));
  return out.MessageId ?? '';
};

let sesSend: SesSend = defaultSesSend;
let sesWait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Test seams (vitest): replace the AWS call and the backoff wait. */
export function __setSesSendForTests(fn: SesSend | null): void { sesSend = fn ?? defaultSesSend; }
export function __setSesWaitForTests(fn: ((ms: number) => Promise<void>) | null): void {
  sesWait = fn ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
}

export function isValidEmailAddress(raw: string | null | undefined): boolean {
  const v = (raw ?? '').trim();
  return !!v && v.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

/** Sends one email through SES with retry; throws on final failure. Returns the message id. */
export async function sendViaSes(cfg: SesConfig, to: string[], subject: string, html: string): Promise<string> {
  if (cfg.mode === 'json-test') {
    logEmailEvent('INFO', 'SES json-test send', { from: cfg.from, to, subject });
    return 'json-test';
  }
  let lastErr: unknown;
  for (let attempt = 1; attempt <= SES_MAX_ATTEMPTS; attempt++) {
    try {
      const id = await sesSend({ region: cfg.region, from: cfg.from, to, subject, html });
      logEmailEvent('INFO', 'Email sent via SES', { to, subject, messageId: id });
      return id;
    } catch (err: any) {
      lastErr = err;
      const name = String(err?.name ?? '');
      if (SES_PERMANENT_ERRORS.has(name) || attempt === SES_MAX_ATTEMPTS) break;
      await sesWait(SES_BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 250));
    }
  }
  const e = lastErr as { name?: string; message?: string } | undefined;
  logEmailEvent('ERROR', 'SES send failed', { to, subject, error: `${e?.name ?? 'Error'}: ${e?.message ?? lastErr}` });
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * For new callers (approval emails): SES when it is configured, otherwise the existing
 * relay → Gmail path. Resolves with the channel used; never rejects.
 */
export async function sendEmailPreferSes(
  to: string[],
  subject: string,
  htmlBody: string,
): Promise<{ channel: 'ses' | 'legacy' | 'none'; error?: string }> {
  const valid = to.filter(isValidEmailAddress);
  if (valid.length === 0) return { channel: 'none', error: 'no valid recipient address' };
  const cfg = sesConfig();
  if (cfg) {
    try {
      await sendViaSes(cfg, valid, subject, htmlBody);
      return { channel: 'ses' };
    } catch (err: any) {
      return { channel: 'ses', error: err?.message ?? String(err) };
    }
  }
  sendEmail(valid, subject, htmlBody);
  return { channel: 'legacy' };
}

/**
 * Main email sender function:
 * 1. Tries sending via Local Gmail OAuth2 (Primary).
 * 2. If it fails, falls back to sending via External Socket Server API.
 * 3. Log errors if both fail, but do not block the application execution.
 */
export function sendEmail(
  to: string[],
  subject: string,
  htmlBody: string,
  cc?: string[],
  bcc?: string[]
): void {
  // Fire and forget so we don't block the caller (async runner)
  (async () => {
    // Merge CC emails from parameters and environment variables
    const ccList: string[] = [];
    if (cc && cc.length > 0) {
      ccList.push(...cc);
    }
    if (EMAIL_CC) {
      const envCc = EMAIL_CC.split(',').map(email => email.trim()).filter(Boolean);
      ccList.push(...envCc);
    }
    const uniqueCc = Array.from(new Set(ccList));
    const ccParam = uniqueCc.length > 0 ? uniqueCc : undefined;

    try {
      logEmailEvent('INFO', `Attempting to send email via External API. To: ${to.join(', ')} | CC: ${uniqueCc.join(', ')}`);
      await sendViaExternalApi(to, subject, htmlBody, ccParam, bcc);
    } catch (externalApiError: any) {
      logEmailEvent('WARN', 'External API send failed. Falling back to Local Gmail API...', externalApiError.message || externalApiError);
      try {
        await sendViaLocalGmail(to, subject, htmlBody, ccParam, bcc);
      } catch (localGmailError: any) {
        logEmailEvent('ERROR', 'Critical: Fallback to Local Gmail API also failed. Email was NOT sent.', localGmailError.message || localGmailError);
      }
    }
  })();
}


