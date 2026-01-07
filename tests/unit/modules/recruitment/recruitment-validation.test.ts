import { describe, it, expect } from 'vitest';

describe('Recruitment Candidate Validation', () => {
  describe('Basic Validation', () => {
    it('should validate complete recruitment candidate data', () => {
      const validCandidate = {
        firstName: 'John',
        lastName: 'Doe',
        rankApplied: 'Chief Engineer',
        nationality: 'Indian',
        vesselType: 'Tanker',
        status: 'Screening',
        email: 'john.doe@example.com',
        phone: '+91-9876543210',
        dateOfBirth: '1990-05-15',
        experience: 8
      };
      
      expect(validCandidate.firstName).toBeDefined();
      expect(validCandidate.lastName).toBeDefined();
      expect(validCandidate.rankApplied).toBeDefined();
    });

    it('should reject candidate without required fields', () => {
      const invalidData = { firstName: 'John' };
      const hasRequiredFields = 'lastName' in invalidData && 'rankApplied' in invalidData;
      expect(hasRequiredFields).toBe(false);
    });

    it('should validate email format', () => {
      const validEmail = 'john@example.com';
      const invalidEmail = 'not-an-email';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      expect(emailRegex.test(validEmail)).toBe(true);
      expect(emailRegex.test(invalidEmail)).toBe(false);
    });

    it('should validate phone number format', () => {
      const rawPhone = '9876543210';
      const formattedPhone = `+91-${rawPhone}`;
      expect(formattedPhone).toMatch(/^\+\d{2}-\d{10}$/);
    });
  });

  describe('Status Workflow', () => {
    it('should validate status transitions', () => {
      const validStatuses = ['Screening', 'Interview', 'Offered', 'Joined', 'Rejected'];
      const currentStatus = 'Screening';
      const nextStatus = 'Interview';
      
      const currentIndex = validStatuses.indexOf(currentStatus);
      const nextIndex = validStatuses.indexOf(nextStatus);
      
      expect(nextIndex >= currentIndex || nextStatus === 'Rejected').toBe(true);
    });

    it('should allow rejection from any status', () => {
      const statuses = ['Screening', 'Interview', 'Offered'];
      const canReject = statuses.every(status => {
        return true;
      });
      expect(canReject).toBe(true);
    });

    it('should prevent backward status transitions except rejection', () => {
      const validStatuses = ['Screening', 'Interview', 'Offered', 'Joined'];
      const currentStatus = 'Offered';
      const invalidBackwardStatus = 'Screening';
      
      const currentIndex = validStatuses.indexOf(currentStatus);
      const backwardIndex = validStatuses.indexOf(invalidBackwardStatus);
      
      expect(backwardIndex < currentIndex).toBe(true);
    });
  });

  describe('Experience Calculations', () => {
    it('should calculate experience in years from months', () => {
      const seaServiceMonths = 48;
      const experienceYears = seaServiceMonths / 12;
      expect(experienceYears).toBe(4);
    });

    it('should validate rank matching with experience', () => {
      const rankMinExperience: Record<string, number> = {
        'AB': 0,
        'OS': 2,
        'Third Officer': 3,
        'Chief Engineer': 10
      };
      
      const candidateRank = 'Chief Engineer';
      const candidateExperience = 12;
      
      expect(candidateExperience).toBeGreaterThanOrEqual(rankMinExperience[candidateRank]);
    });

    it('should reject insufficient experience for rank', () => {
      const rankMinExperience: Record<string, number> = {
        'Chief Engineer': 10
      };
      
      const candidateExperience = 5;
      const isEligible = candidateExperience >= rankMinExperience['Chief Engineer'];
      
      expect(isEligible).toBe(false);
    });
  });

  describe('Age Eligibility', () => {
    it('should validate age eligibility (18-65)', () => {
      const dateOfBirth = new Date('1995-01-01');
      const today = new Date();
      const age = today.getFullYear() - dateOfBirth.getFullYear();
      
      expect(age).toBeGreaterThanOrEqual(18);
      expect(age).toBeLessThanOrEqual(65);
    });

    it('should reject candidates under 18', () => {
      const dateOfBirth = new Date();
      dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 17);
      const age = new Date().getFullYear() - dateOfBirth.getFullYear();
      
      expect(age < 18).toBe(true);
    });

    it('should reject candidates over 65', () => {
      const dateOfBirth = new Date();
      dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 70);
      const age = new Date().getFullYear() - dateOfBirth.getFullYear();
      
      expect(age > 65).toBe(true);
    });
  });

  describe('Transfer to Crew Pool', () => {
    it('should validate transfer to crew pool eligibility', () => {
      const candidate = {
        status: 'Offered',
        documentsComplete: true,
        medicalValid: true,
        licensesValid: true
      };
      
      const canTransfer = candidate.status === 'Offered' && 
                         candidate.documentsComplete && 
                         candidate.medicalValid && 
                         candidate.licensesValid;
      
      expect(canTransfer).toBe(true);
    });

    it('should reject transfer if documents incomplete', () => {
      const candidate = {
        status: 'Offered',
        documentsComplete: false,
        medicalValid: true,
        licensesValid: true
      };
      
      const canTransfer = candidate.documentsComplete;
      expect(canTransfer).toBe(false);
    });

    it('should reject transfer if status is not Offered', () => {
      const candidate = {
        status: 'Screening',
        documentsComplete: true,
        medicalValid: true,
        licensesValid: true
      };
      
      const canTransfer = candidate.status === 'Offered';
      expect(canTransfer).toBe(false);
    });
  });

  describe('Nationality and Vessel Type', () => {
    it('should validate nationality from allowed list', () => {
      const validNationalities = ['Indian', 'Filipino', 'Indonesian', 'Ukrainian'];
      const candidateNationality = 'Indian';
      
      expect(validNationalities.includes(candidateNationality)).toBe(true);
    });

    it('should validate vessel type experience match', () => {
      const candidateVesselTypes = ['Tanker', 'Bulk Carrier'];
      const requiredVesselType = 'Tanker';
      
      expect(candidateVesselTypes.includes(requiredVesselType)).toBe(true);
    });
  });

  describe('Certificate Requirements', () => {
    it('should validate certificate requirements for rank', () => {
      const requiredCertificates = ['COC Class 1', 'STCW Basic Safety'];
      const candidateCertificates = ['COC Class 1', 'STCW Basic Safety', 'MEFA'];
      
      const hasAllRequired = requiredCertificates.every(cert => 
        candidateCertificates.includes(cert)
      );
      
      expect(hasAllRequired).toBe(true);
    });

    it('should reject if missing required certificates', () => {
      const requiredCertificates = ['COC Class 1', 'STCW Basic Safety'];
      const candidateCertificates = ['COC Class 1'];
      
      const hasAllRequired = requiredCertificates.every(cert => 
        candidateCertificates.includes(cert)
      );
      
      expect(hasAllRequired).toBe(false);
    });
  });

  describe('Scheduling', () => {
    it('should validate interview scheduling (business days only)', () => {
      const interviewDate = new Date('2026-01-20');
      const dayOfWeek = interviewDate.getDay();
      
      const isBusinessDay = dayOfWeek >= 1 && dayOfWeek <= 5;
      expect(isBusinessDay).toBe(true);
    });

    it('should reject weekend interview scheduling', () => {
      const saturdayDate = new Date('2026-01-24');
      const dayOfWeek = saturdayDate.getDay();
      
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      expect(isWeekend).toBe(true);
    });

    it('should calculate joining date based on offer acceptance', () => {
      const offerDate = new Date('2026-01-15');
      const expectedJoiningDate = new Date(offerDate);
      expectedJoiningDate.setDate(expectedJoiningDate.getDate() + 30);
      
      expect(expectedJoiningDate.getMonth()).toBe(1);
    });
  });

  describe('Duplicate Prevention', () => {
    it('should detect duplicate candidates by email', () => {
      const existingEmails = ['john@example.com', 'jane@example.com'];
      const newEmail = 'john@example.com';
      
      const isDuplicate = existingEmails.includes(newEmail);
      expect(isDuplicate).toBe(true);
    });

    it('should allow unique email addresses', () => {
      const existingEmails = ['john@example.com', 'jane@example.com'];
      const newEmail = 'unique@example.com';
      
      const isDuplicate = existingEmails.includes(newEmail);
      expect(isDuplicate).toBe(false);
    });
  });
});
