import { describe, it, expect } from 'vitest';
import { buildInterviewAssignmentEmail } from '../../../server/v2/recruitment/templates/interviewNotificationTemplate';

describe('B6 Interview Notification Email Template', () => {
  it('should generate correct subject and body with all params', () => {
    const params = {
      interviewerName: 'John Doe',
      seafarerName: 'Jane Smith',
      rank: 'Chief Officer',
      interviewDate: '2026-07-20',
      applicationRef: 'APP-12345',
      applicationLink: 'https://dev.sl-sail.com/crewing/recruitment/uuid-123'
    };

    const result = buildInterviewAssignmentEmail(params);

    expect(result.subject).toBe('Interview Assignment – Jane Smith (Chief Officer)');
    expect(result.html).toContain('Hello John Doe');
    expect(result.html).toContain('Jane Smith');
    expect(result.html).toContain('Chief Officer');
    expect(result.html).toContain('APP-12345');
    expect(result.html).toContain('https://dev.sl-sail.com/crewing/recruitment/uuid-123');
  });

  it('should handle missing interviewDate gracefully', () => {
    const params = {
      interviewerName: 'John Doe',
      seafarerName: 'Jane Smith',
      rank: 'Chief Officer',
      applicationRef: 'APP-12345',
      applicationLink: 'https://dev.sl-sail.com/crewing/recruitment/uuid-123'
    };

    const result = buildInterviewAssignmentEmail(params);

    expect(result.html).toContain('Not Scheduled Yet');
  });
});
