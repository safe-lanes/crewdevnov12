/**
 * Generates the HTML body and subject line for the B6 Interview Assignment notification email.
 */
export function buildInterviewAssignmentEmail(params: {
  interviewerName: string;
  seafarerName: string;
  rank: string;
  interviewDate?: string | null;
  applicationRef: string | null;
  applicationLink: string;
}): { subject: string; html: string } {
  const subject = `Interview Assignment - ${params.seafarerName} (${params.rank})`;
  
  const formattedDate = params.interviewDate 
    ? new Date(params.interviewDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'Not Scheduled Yet';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background-color: #f4f6f9;
      color: #333333;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f4f6f9;
      padding: 20px 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
      border: 1px solid #e1e4e8;
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      padding: 30px 20px;
      text-align: center;
      color: #ffffff;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .content {
      padding: 30px 25px;
      line-height: 1.6;
    }
    .greeting {
      font-size: 18px;
      font-weight: bold;
      color: #1e3a8a;
      margin-top: 0;
      margin-bottom: 15px;
    }
    .message {
      font-size: 16px;
      color: #4b5563;
      margin-bottom: 25px;
    }
    .details-card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 20px;
      margin-bottom: 25px;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
    }
    .details-table td {
      padding: 8px 0;
      vertical-align: top;
      font-size: 15px;
    }
    .details-label {
      font-weight: 600;
      color: #475569;
      width: 180px;
    }
    .details-value {
      color: #1e293b;
    }
    .btn-container {
      text-align: center;
      margin: 30px 0 10px 0;
    }
    .btn {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 30px;
      font-size: 16px;
      font-weight: 600;
      border-radius: 6px;
      box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);
      transition: background-color 0.2s ease;
    }
    .footer {
      background-color: #f1f5f9;
      padding: 20px;
      text-align: center;
      font-size: 13px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      margin: 5px 0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Interview Assignment</h1>
      </div>
      <div class="content">
        <p class="greeting">Hello ${params.interviewerName || 'Interviewer'},</p>
        <p class="message">You have been assigned to conduct an interview for the following seafarer candidate:</p>
        
        <div class="details-card">
          <table class="details-table">
            <tr>
              <td class="details-label">Seafarer Name</td>
              <td class="details-value"><strong>${params.seafarerName}</strong></td>
            </tr>
            <tr>
              <td class="details-label">Applied Rank</td>
              <td class="details-value">${params.rank}</td>
            </tr>
            <tr>
              <td class="details-label">Interview Date</td>
              <td class="details-value">${formattedDate}</td>
            </tr>
            <tr>
              <td class="details-label">Application Reference</td>
              <td class="details-value">${params.applicationRef || 'N/A'}</td>
            </tr>
          </table>
        </div>
        
        <div class="btn-container">
          <a href="${params.applicationLink}" class="btn" target="_blank">Open Application</a>
        </div>
      </div>
      <div class="footer">
        <p>This is an automated notification from the SAIL Crewing Management System.</p>
        <p>&copy; ${new Date().getFullYear()} SAIL. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}
