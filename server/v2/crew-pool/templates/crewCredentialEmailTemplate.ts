function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export function buildCrewCredentialEmail(params: {
  firstName: string;
  domain: string;
  empNo: string;
  temporaryPassword: string;
  loginLink: string;
}): { subject: string; html: string } {
  const first = escapeHtml(params.firstName);
  const domain = escapeHtml(params.domain);
  const empNo = escapeHtml(params.empNo);
  const password = escapeHtml(params.temporaryPassword);
  const link = escapeHtml(params.loginLink);
  return {
    subject: `Crew mobile account access - ${params.empNo}`,
    html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f6f9;padding:24px;color:#334155">
      <div style="max-width:600px;margin:auto;background:#fff;border:1px solid #e2e8f0;padding:28px">
      <h2 style="color:#1e3a8a">Crew Mobile Account</h2><p>Hello ${first},</p>
      <p>Your crew mobile account has been provisioned. Use the one-time password below to sign in.</p>
      <table cellpadding="8"><tr><td><b>Domain</b></td><td>${domain}</td></tr>
      <tr><td><b>Employee ID</b></td><td>${empNo}</td></tr>
      <tr><td><b>One-time password</b></td><td><code>${password}</code></td></tr></table>
      <p><a href="${link}" style="background:#2563eb;color:#fff;padding:12px 20px;text-decoration:none">Open Crew Mobile App</a></p>
      <p>For your security, this password works only once. Change it immediately when prompted on your first login.</p>
      <p style="color:#64748b;font-size:12px">If you did not request this, contact your crewing administrator.</p>
      </div></body></html>`,
  };
}