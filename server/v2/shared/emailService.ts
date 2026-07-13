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

// Log initialization details
logEmailEvent('INFO', 'EmailService Initializing', {
  GMAIL_SUPPORT_EMAIL,
  GMAIL_CLIENT_ID: GMAIL_CLIENT_ID ? GMAIL_CLIENT_ID.substring(0, 15) + '...' : 'undefined/empty',
  GMAIL_REFRESH_TOKEN: GMAIL_REFRESH_TOKEN ? GMAIL_REFRESH_TOKEN.substring(0, 15) + '...' : 'undefined/empty',
  EMAIL_API_URL,
  EMAIL_CC
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
      logEmailEvent('INFO', `Attempting to send email via Local Gmail API. To: ${to.join(', ')} | CC: ${uniqueCc.join(', ')}`);
      await sendViaLocalGmail(to, subject, htmlBody, ccParam, bcc);
    } catch (localGmailError: any) {
      logEmailEvent('WARN', 'Local Gmail send failed. Falling back to External API...', localGmailError.message || localGmailError);
      try {
        await sendViaExternalApi(to, subject, htmlBody, ccParam, bcc);
      } catch (externalApiError: any) {
        logEmailEvent('ERROR', 'Critical: Fallback to External API also failed. Email was NOT sent.', externalApiError.message || externalApiError);
      }
    }
  })();
}

