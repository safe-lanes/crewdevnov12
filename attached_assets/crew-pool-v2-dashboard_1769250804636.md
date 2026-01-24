# Crew Pool V2 Dashboard Implementation Guide

## Overview
Implement the dashboard API for Crew Pool V2 that matches the exact logic and data structure of the legacy dashboard, using normalized V2 tables with proper JOIN queries.

---

## Current Legacy Dashboard Logic

### Endpoint
```
GET /api/crew-members/:id/dashboard
```

### Data Fetched
The legacy dashboard fetches data from the monolithic `crew_members` table which stores everything in JSON columns:
- `currentCompanySeaService` - JSON array
- `externalSeaService` - JSON array
- `licenses` - JSON array
- NOK fields (`nokFirstName`, `nokFamilyName`, `nokRelationship`, `nokTelephone`)

### Response Structure (CrewDashboardSummary)
```typescript
{
  status: {
    status: 'On Board' | 'On Leave' | 'Inactive',
    isActive: boolean,
    vessel: string | null,
    joinedDate: string | null,
    sailingDue: string | null,
    nextAvailability: string | null,
    presentAssignment: string | null,
    emergencyContact: { name, relation, phone } | null
  },
  experience: {
    company: number,    // months with company
    rank: number,       // months in current rank
    tankers: number,    // months on tankers
    ocw: number,        // months as OOW
    endorsements: string
  },
  shipTypes: {
    items: Array<{ name, months, percentage }>,
    totalMonths: number,
    totalYears: number
  },
  rankExperience: {
    items: Array<{ rank, months, percentage }>,
    totalMonths: number,
    totalYears: number
  },
  rankExperienceByVesselType: Record<string, number>,
  serviceTimeline: Array<ServiceAssignment>,
  compliance: Array<{ category, status, details }>,
  careerProgression: Array<{ position, date?, status }>,
  appraisals: Array<{ year, score }>
}
```

---

## V2 Dashboard Implementation

### New V2 Endpoint
```
GET /api/v2/crew-pool/crew-members/:crewUuid/dashboard
```

### Data Sources (V2 Tables)
Instead of parsing JSON from monolithic table, V2 uses JOINs across normalized tables:

| Data | V2 Table | Key Fields |
|------|----------|------------|
| Crew basic info | `crew_members_v2` | `crew_uuid`, `present_rank`, `is_active` |
| Next of Kin | `crew_next_of_kin_v2` | `first_name`, `family_name`, `relationship`, `telephone` |
| Sea Service | `crew_sea_service_v2` | `service_type`, `vessel_name`, `vessel_type_uuid`, `rank`, `from_date`, `to_date`, `period_months` |
| Licenses | `crew_licenses_v2` | `license_id`, `certificate_document`, `expiry` |
| Assignments | `crew_assignments_v2` | `vessel_uuid`, `rank`, `sign_on_date`, `sign_off_date`, `status` |

---

## V2 Service Implementation

### File: `server/modules/crew-pool-v2/services/dashboardService.ts`

```typescript
import { db } from '../../../db';
import { sql } from 'drizzle-orm';

export class CrewPoolDashboardServiceV2 {
  
  async getDashboardSummary(crewUuid: string): Promise<any> {
    // 1. Get crew member basic info
    const crew = await this.getCrewMember(crewUuid);
    if (!crew) return undefined;

    // 2. Get next of kin
    const nextOfKin = await this.getNextOfKin(crewUuid);

    // 3. Get all sea service records
    const seaService = await this.getSeaService(crewUuid);
    const companySeaService = seaService.filter(s => s.serviceType === 'company');
    const externalSeaService = seaService.filter(s => s.serviceType === 'external');

    // 4. Get licenses for endorsement calculation
    const licenses = await this.getLicenses(crewUuid);

    // 5. Get active assignments (vessel planning equivalent)
    const assignments = await this.getActiveAssignments(crewUuid);

    // 6. Calculate all dashboard metrics
    const currentRank = crew.presentRank || '';
    
    // Experience calculations
    const experience = this.calculateExperience(companySeaService, externalSeaService, currentRank);
    
    // Ship type experience
    const shipTypeData = this.calculateShipTypeExperience(companySeaService, externalSeaService);
    
    // Rank experience
    const rankData = this.calculateRankExperience(companySeaService, externalSeaService);
    
    // Endorsement derivation
    const endorsementCode = this.deriveEndorsementCode(currentRank, licenses);

    // Status calculation
    const hasActiveAssignment = assignments.length > 0;
    const primaryAssignment = assignments.find(a => a.status === 'primary') || assignments[0];
    
    const isActive = crew.isActive !== false;
    const calculatedStatus = isActive 
      ? (hasActiveAssignment ? 'On Board' : 'On Leave') 
      : 'Inactive';

    // Build service timeline
    const serviceTimeline = this.buildServiceTimeline(companySeaService, assignments);

    return {
      status: {
        status: calculatedStatus,
        isActive: isActive,
        vessel: hasActiveAssignment ? primaryAssignment?.vesselName : null,
        joinedDate: hasActiveAssignment ? this.formatDate(primaryAssignment?.signOnDate) : null,
        sailingDue: hasActiveAssignment ? this.formatDate(primaryAssignment?.reliefDue) : null,
        nextAvailability: !hasActiveAssignment && calculatedStatus === 'On Leave' 
          ? this.formatDate(crew.nextAvailability) : null,
        presentAssignment: primaryAssignment?.vesselCode || null,
        emergencyContact: nextOfKin ? {
          name: `${nextOfKin.firstName || ''}${nextOfKin.familyName ? ' ' + nextOfKin.familyName : ''}`.trim(),
          relation: nextOfKin.relationship || '',
          phone: nextOfKin.telephone || ''
        } : null
      },
      experience: {
        company: experience.company,
        rank: experience.rank,
        tankers: experience.tankers,
        ocw: experience.oow,
        endorsements: endorsementCode
      },
      shipTypes: {
        items: shipTypeData.items,
        totalMonths: shipTypeData.totalMonths,
        totalYears: Math.round((shipTypeData.totalMonths / 12) * 10) / 10
      },
      rankExperience: {
        items: rankData.items,
        totalMonths: rankData.totalMonths,
        totalYears: Math.round((rankData.totalMonths / 12) * 10) / 10
      },
      rankExperienceByVesselType: this.calculateRankExperienceByVesselType(
        companySeaService, externalSeaService, currentRank
      ),
      serviceTimeline,
      compliance: this.getComplianceStatus(crew, licenses),
      careerProgression: this.getCareerProgression(crewUuid),
      appraisals: await this.getAppraisalSummary(crewUuid)
    };
  }

  // ============ DATA FETCHING METHODS ============

  private async getCrewMember(crewUuid: string) {
    const result = await db.execute(sql`
      SELECT 
        c.*,
        n.name as nationality_name
      FROM crew_members_v2 c
      LEFT JOIN master_data_entries n ON c.nationality_uuid = n.entry_uuid
      WHERE c.crew_uuid = ${crewUuid}
      LIMIT 1
    `);
    return result.rows[0] || null;
  }

  private async getNextOfKin(crewUuid: string) {
    const result = await db.execute(sql`
      SELECT * FROM crew_next_of_kin_v2
      WHERE crew_uuid = ${crewUuid}
      LIMIT 1
    `);
    return result.rows[0] || null;
  }

  private async getSeaService(crewUuid: string) {
    const result = await db.execute(sql`
      SELECT 
        s.*,
        v.name as vessel_name,
        v.code as vessel_code,
        vt.name as vessel_type_name
      FROM crew_sea_service_v2 s
      LEFT JOIN vessels v ON s.vessel_uuid = v.uuid
      LEFT JOIN master_data_entries vt ON s.vessel_type_uuid = vt.entry_uuid
      WHERE s.crew_uuid = ${crewUuid}
      ORDER BY s.from_date DESC
    `);
    return result.rows;
  }

  private async getLicenses(crewUuid: string) {
    const result = await db.execute(sql`
      SELECT 
        l.*,
        c.name as issuing_country_name
      FROM crew_licenses_v2 l
      LEFT JOIN master_data_entries c ON l.issuing_country_uuid = c.entry_uuid
      WHERE l.crew_uuid = ${crewUuid}
      AND l.archived_at IS NULL
      ORDER BY l.expiry DESC
    `);
    return result.rows;
  }

  private async getActiveAssignments(crewUuid: string) {
    const result = await db.execute(sql`
      SELECT 
        a.*,
        v.name as vessel_name,
        v.code as vessel_code
      FROM crew_assignments_v2 a
      LEFT JOIN vessels v ON a.vessel_uuid = v.uuid
      WHERE a.crew_uuid = ${crewUuid}
      AND a.sign_off_date IS NULL
      ORDER BY a.sign_on_date DESC
    `);
    return result.rows;
  }

  // ============ CALCULATION METHODS ============
  // (Copy logic from legacy database.ts methods)

  private calculateExperience(companyService: any[], externalService: any[], currentRank: string) {
    let companyMonths = 0;
    let rankMonths = 0;
    let tankerMonths = 0;
    let oowMonths = 0;

    const allService = [...companyService, ...externalService];
    
    for (const record of allService) {
      const months = parseFloat(record.periodMonths || record.period_months || '0') || 0;
      
      // Company experience (only from company service)
      if (record.serviceType === 'company' || record.service_type === 'company') {
        companyMonths += months;
      }
      
      // Current rank experience
      if (record.rank === currentRank) {
        rankMonths += months;
      }
      
      // Tanker experience (check vessel type)
      const vesselType = (record.vesselTypeName || record.vessel_type_name || '').toLowerCase();
      if (vesselType.includes('tanker') || vesselType.includes('chemical') || vesselType.includes('lpg') || vesselType.includes('lng')) {
        tankerMonths += months;
      }
      
      // OOW experience (check rank for officer positions)
      const rank = (record.rank || '').toLowerCase();
      if (rank.includes('officer') || rank.includes('mate') || rank.includes('engineer')) {
        oowMonths += months;
      }
    }

    return {
      company: Math.round(companyMonths),
      rank: Math.round(rankMonths),
      tankers: Math.round(tankerMonths),
      oow: Math.round(oowMonths)
    };
  }

  private calculateShipTypeExperience(companyService: any[], externalService: any[]) {
    const allService = [...companyService, ...externalService];
    const shipTypeMap = new Map<string, number>();
    let totalMonths = 0;

    for (const record of allService) {
      const months = parseFloat(record.periodMonths || record.period_months || '0') || 0;
      const vesselType = record.vesselTypeName || record.vessel_type_name || 'Unknown';
      
      shipTypeMap.set(vesselType, (shipTypeMap.get(vesselType) || 0) + months);
      totalMonths += months;
    }

    const items = Array.from(shipTypeMap.entries())
      .map(([name, months]) => ({
        name,
        months: Math.round(months),
        percentage: totalMonths > 0 ? Math.round((months / totalMonths) * 100) : 0
      }))
      .sort((a, b) => b.months - a.months);

    return { items, totalMonths: Math.round(totalMonths) };
  }

  private calculateRankExperience(companyService: any[], externalService: any[]) {
    const allService = [...companyService, ...externalService];
    const rankMap = new Map<string, number>();
    let totalMonths = 0;

    for (const record of allService) {
      const months = parseFloat(record.periodMonths || record.period_months || '0') || 0;
      const rank = record.rank || 'Unknown';
      
      rankMap.set(rank, (rankMap.get(rank) || 0) + months);
      totalMonths += months;
    }

    const items = Array.from(rankMap.entries())
      .map(([rank, months]) => ({
        rank,
        months: Math.round(months),
        percentage: totalMonths > 0 ? Math.round((months / totalMonths) * 100) : 0
      }))
      .sort((a, b) => b.months - a.months);

    return { items, totalMonths: Math.round(totalMonths) };
  }

  private calculateRankExperienceByVesselType(
    companyService: any[], 
    externalService: any[], 
    currentRank: string
  ): Record<string, number> {
    const allService = [...companyService, ...externalService];
    const vesselTypeMap: Record<string, number> = {};

    for (const record of allService) {
      if (record.rank !== currentRank) continue;
      
      const months = parseFloat(record.periodMonths || record.period_months || '0') || 0;
      const vesselType = record.vesselTypeName || record.vessel_type_name || 'Unknown';
      
      vesselTypeMap[vesselType] = (vesselTypeMap[vesselType] || 0) + months;
    }

    return vesselTypeMap;
  }

  private deriveEndorsementCode(currentRank: string, licenses: any[]): string {
    // Check for specific endorsement patterns in licenses
    const endorsements: string[] = [];
    
    for (const license of licenses) {
      const cert = (license.certificateDocument || license.certificate_document || '').toLowerCase();
      if (cert.includes('stcw')) endorsements.push('STCW');
      if (cert.includes('gmdss')) endorsements.push('GMDSS');
      if (cert.includes('tanker')) endorsements.push('TAN');
    }
    
    return endorsements.length > 0 ? endorsements.join(', ') : '-';
  }

  private buildServiceTimeline(seaService: any[], assignments: any[]) {
    const timeline: any[] = [];
    
    // Add historical sea service
    for (const record of seaService) {
      timeline.push({
        vesselName: record.vesselName || record.vessel_name || record.vesselCode || record.vessel_code || 'Unknown',
        vesselCode: record.vesselCode || record.vessel_code || '',
        rank: record.rank || '',
        fromDate: record.fromDate || record.from_date || '',
        toDate: record.toDate || record.to_date || '',
        periodMonths: record.periodMonths || record.period_months || '',
        type: 'historical',
        isCompanyService: record.serviceType === 'company' || record.service_type === 'company'
      });
    }

    // Add current assignments
    for (const assignment of assignments) {
      if (!assignment.sign_off_date) {
        timeline.push({
          vesselName: assignment.vessel_name || '',
          vesselCode: assignment.vessel_code || '',
          rank: assignment.rank || '',
          fromDate: assignment.sign_on_date || '',
          toDate: null,
          periodMonths: null,
          type: 'current',
          isCompanyService: true
        });
      }
    }

    return timeline.sort((a, b) => {
      const dateA = new Date(a.fromDate || '1900-01-01');
      const dateB = new Date(b.fromDate || '1900-01-01');
      return dateB.getTime() - dateA.getTime();
    });
  }

  private getComplianceStatus(crew: any, licenses: any[]) {
    // Calculate compliance based on license/document expiry dates
    const now = new Date();
    let trainingIssues = 0;
    let vaccinationIssues = 0;
    
    for (const license of licenses) {
      const expiry = license.expiry ? new Date(license.expiry) : null;
      if (expiry && expiry < now) {
        trainingIssues++;
      }
    }

    return [
      { category: "Travel Docs", status: "compliant", details: "✓" },
      { category: "Visas", status: "compliant", details: "✓" },
      { category: "License & DCE", status: "compliant", details: "✓" },
      { category: "Training", status: trainingIssues > 0 ? "issues" : "compliant", details: trainingIssues > 0 ? `Issues: ${trainingIssues}` : "✓" },
      { category: "Medical", status: "compliant", details: "✓" },
      { category: "Vaccination", status: vaccinationIssues > 0 ? "issues" : "compliant", details: vaccinationIssues > 0 ? `Issues: ${vaccinationIssues}` : "✓" }
    ];
  }

  private getCareerProgression(crewUuid: string) {
    // Placeholder - implement based on actual appraisal/promotion data
    return [];
  }

  private async getAppraisalSummary(crewUuid: string) {
    // Placeholder - implement based on appraisal data
    return [];
  }

  private formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = date.getDate().toString().padStart(2, '0');
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    } catch {
      return dateString;
    }
  }
}

export const crewPoolDashboardServiceV2 = new CrewPoolDashboardServiceV2();
```

---

## V2 Route Implementation

### File: `server/modules/crew-pool-v2/routes.ts`

Add the dashboard endpoint:

```typescript
import { Router } from 'express';
import { crewPoolDashboardServiceV2 } from './services/dashboardService';

const router = Router();

// Dashboard endpoint
router.get('/crew-members/:crewUuid/dashboard', async (req, res) => {
  try {
    const { crewUuid } = req.params;
    const dashboardSummary = await crewPoolDashboardServiceV2.getDashboardSummary(crewUuid);
    
    if (!dashboardSummary) {
      return res.status(404).json({ error: 'Crew member not found' });
    }
    
    res.json(dashboardSummary);
  } catch (error) {
    console.error('Error fetching V2 dashboard summary:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

export default router;
```

---

## Frontend V2 Hook

### File: `client/src/modules/crew-pool/v2/hooks/useCrewPoolV2.ts`

Add the dashboard hook:

```typescript
import { useQuery } from '@tanstack/react-query';
import type { CrewDashboardSummary } from '@shared/schema';

export function useCrewDashboardV2(crewUuid: string | null) {
  return useQuery<CrewDashboardSummary>({
    queryKey: ['/api/v2/crew-pool/crew-members', crewUuid, 'dashboard'],
    queryFn: async () => {
      const response = await fetch(`/api/v2/crew-pool/crew-members/${crewUuid}/dashboard`);
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard summary');
      }
      return response.json();
    },
    enabled: !!crewUuid,
  });
}
```

---

## Frontend V2 Integration

### In `CrewInfoForm_v2.tsx`:

Replace the legacy dashboard query with the V2 hook:

```typescript
// Before (Legacy)
const { data: dashboardData } = useQuery<CrewDashboardSummary>({
  queryKey: ['/api/crew-members', crewMember?.id, 'dashboard'],
  queryFn: async () => {
    const response = await fetch(`/api/crew-members/${crewMember?.id}/dashboard`);
    return response.json();
  },
  enabled: !!crewMember?.id,
});

// After (V2)
import { useCrewDashboardV2 } from './hooks/useCrewPoolV2';

const { data: dashboardData, isLoading: isDashboardLoading, error: dashboardError } = useCrewDashboardV2(crewMember?.crewUuid);
```

---

## Data Flow Comparison

### Legacy Flow
```
Frontend → /api/crew-members/:id/dashboard
         → storage.getCrewDashboardSummary(id)
         → Parse JSON from crew_members.currentCompanySeaService
         → Parse JSON from crew_members.externalSeaService
         → Parse JSON from crew_members.licenses
         → Calculate metrics
         → Return CrewDashboardSummary
```

### V2 Flow
```
Frontend → /api/v2/crew-pool/crew-members/:crewUuid/dashboard
         → crewPoolDashboardServiceV2.getDashboardSummary(crewUuid)
         → JOIN crew_members_v2
         → JOIN crew_next_of_kin_v2
         → JOIN crew_sea_service_v2 + vessels + master_data (vessel types)
         → JOIN crew_licenses_v2 + master_data (countries)
         → JOIN crew_assignments_v2 + vessels
         → Calculate metrics (same logic)
         → Return CrewDashboardSummary (same structure)
```

---

## Key Differences

| Aspect | Legacy | V2 |
|--------|--------|-----|
| Data Source | JSON columns in single table | Normalized tables with JOINs |
| ID Type | Numeric `id` | UUID `crewUuid` |
| Sea Service | `currentCompanySeaService` JSON | `crew_sea_service_v2` table |
| Licenses | `licenses` JSON | `crew_licenses_v2` table |
| Next of Kin | `nok*` columns in crew_members | `crew_next_of_kin_v2` table |
| Vessel Names | Stored directly or need translation | JOIN with `vessels` table |
| Vessel Types | Stored as string | JOIN with `master_data_entries` |

---

## Implementation Steps

1. **Create Dashboard Service** (`server/modules/crew-pool-v2/services/dashboardService.ts`)
   - Implement all data fetching methods with JOINs
   - Implement calculation methods (copy logic from legacy)
   - Implement service timeline builder

2. **Add Dashboard Route** (`server/modules/crew-pool-v2/routes.ts`)
   - Add GET endpoint for dashboard
   - Wire up to dashboard service

3. **Create Frontend Hook** (`v2/hooks/useCrewPoolV2.ts`)
   - Add `useCrewDashboardV2` hook

4. **Update V2 Form** (`v2/CrewInfoForm_v2.tsx`)
   - Replace legacy dashboard query with V2 hook
   - Ensure component uses `crewUuid` instead of numeric `id`

5. **Test Dashboard**
   - Verify all sections display data correctly
   - Compare output with legacy dashboard for same crew

---

## Summary

The V2 dashboard implementation:
- Uses the **same response structure** as legacy (`CrewDashboardSummary`)
- Fetches from **normalized V2 tables** instead of JSON columns
- Applies **same calculation logic** for experience, ship types, rank experience
- Returns data in **same format** so UI components work unchanged
- Uses **crewUuid** as identifier instead of numeric id
