import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, isConnected, connectionError } from "./storage";
import { type VesselPlanning, insertFormSchema, insertRankGroupSchema, insertAvailableRankSchema, updateAvailableRankSchema, insertCrewMemberSchema, insertAppraisalResultSchema, insertRecruitmentCandidateSchema, insertPromotionHierarchySchema, insertCompanyProcessingSchema, insertPromotionFormSchema, insertDataMasterSchema, insertMasterDataEntrySchema, insertVesselGroupSchema, insertVesselDraftSchema, insertVesselRevisionSchema, insertVesselPlanningSchema, insertRotationPlanSchema, insertDrugAlcoholTestRecordSchema, insertRestHoursVesselRecordSchema, insertRestHoursCrewRecordSchema, insertRestHoursDailyRecordSchema, insertFixedTaskSchema, insertVariableTaskSchema, insertVesselViolationCommentSchema, insertOfficeViolationCommentSchema, insertNCReportSchema, insertVesselDateLineAdjustmentSchema } from "@shared/schema";
import { z } from "zod";
import { normalizeCrewMemberForTable, mapFormDataToStorage, fromStorageCrew, toStorageCrew } from "@shared/crew-mapping";
import { 
  isVesselMaster,
  filterVesselMasterData,
  mapDatabaseToVesselDisplay,
  validateVesselMasterEntry,
  getVesselMasterInfo,
  isAdditionalGroupsMaster,
  isVesselOwnersMaster,
  needsSpecialHandling,
  applyMasterSpecificFiltering,
  applyMasterSpecificMapping,
  validateMasterSpecificEntry
} from "./vesselMasterSafety";
import { parseFlexibleDate, formatToISO } from "../shared/date-utils";

/**
 * Basic field transformation from snake_case (database) to camelCase (frontend)
 * for all master data entries
 */
function applyBasicFieldTransformation(entry: any): any {
  if (!entry) return entry;
  
  const transformed = { ...entry };
  
  // Convert snake_case database fields to camelCase frontend fields
  if (entry.entry_id !== undefined) {
    transformed.entryId = entry.entry_id;
    delete transformed.entry_id;
  }
  
  if (entry.master_id !== undefined) {
    transformed.masterId = entry.master_id;
    delete transformed.master_id;
  }
  
  if (entry.created_at !== undefined) {
    transformed.createdAt = entry.created_at;
    delete transformed.created_at;
  }
  
  if (entry.updated_at !== undefined) {
    transformed.updatedAt = entry.updated_at;
    delete transformed.updated_at;
  }
  
  return transformed;
}

// Schema for rank reorder request
const rankReorderSchema = z.array(z.object({
  id: z.number(),
  sortOrder: z.number().int().nonnegative()
}));

// Stage-specific validation schemas for appraisal submissions
const stage1SubmissionSchema = z.object({
  data: z.object({
    seafarersName: z.string().min(1),
    seafarersRank: z.string().min(1),
    nationality: z.string().min(1),
    vessel: z.string().min(1),
    appraisalType: z.string().min(1),
    signOn: z.string().optional(),
    appraisalPeriodFrom: z.string().optional(),
    appraisalPeriodTo: z.string().optional(),
    personalityIndexCategory: z.string().optional(),
    primaryAppraiser: z.string().optional(),
    trainings: z.array(z.any()).optional(),
    targets: z.array(z.any()).optional(),
  }),
  submittedBy: z.string().optional(),
});

const stage2SubmissionSchema = z.object({
  data: z.object({
    competenceAssessments: z.array(z.any()).optional(),
    behaviouralAssessments: z.array(z.any()).optional(),
    trainingNeeds: z.array(z.any()).optional(),
    recommendations: z.array(z.any()).optional(),
    appraiserComments: z.array(z.any()).optional(),
    seafarerComments: z.array(z.any()).optional(),
  }),
  submittedBy: z.string().optional(),
});

const stage3SubmissionSchema = z.object({
  data: z.object({
    officeReviews: z.array(z.any()).optional(),
    trainingFollowups: z.array(z.any()).optional(),
  }),
  submittedBy: z.string().optional(),
});

// Helper function to convert time string (HH:MM) to half-hour cell index (0-47)
function timeToCell(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 2 + (minutes >= 30 ? 1 : 0);
}

// Helper function to calculate vessel review status
function calculateVesselReviewStatus(monthValue: string, vesselReviewSubmittedDate?: Date | null): string {
  // If already submitted, it's completed
  if (vesselReviewSubmittedDate) {
    return 'Completed';
  }
  
  // Parse month value (format: "YYYY-MM")
  const [year, month] = monthValue.split('-').map(Number);
  
  // Calculate next month (1st day)
  const nextMonth = new Date(year, month, 1); // month is 0-indexed, so month value gives us next month
  
  // Calculate overdue date (7th of next month)
  const overdueDate = new Date(year, month, 7);
  
  // Get current date
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Reset to start of day for fair comparison
  
  // Before the 1st of next month, no status yet
  if (now < nextMonth) {
    return '';
  }
  
  // Compare dates
  if (now >= overdueDate) {
    return 'Overdue';
  } else if (now >= nextMonth) {
    return 'Due';
  }
  
  return '';
}

function calculateOfficeReviewStatus(
  monthValue: string, 
  vesselReviewSubmittedDate?: Date | null,
  officeReviewSubmittedDate?: Date | null
): string {
  // If office has already submitted, it's completed
  if (officeReviewSubmittedDate) {
    return 'Completed';
  }
  
  // If vessel hasn't submitted yet, no office review status
  if (!vesselReviewSubmittedDate) {
    return '';
  }
  
  // Parse month value (format: "YYYY-MM")
  const [year, month] = monthValue.split('-').map(Number);
  
  // Calculate next month (1st day)
  const nextMonth = new Date(year, month, 1); // month is 0-indexed, so month value gives us next month
  
  // Calculate overdue date (10th of next month for office review)
  const overdueDate = new Date(year, month, 10);
  
  // Get current date
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Reset to start of day for fair comparison
  
  // Office review becomes due as soon as vessel submits
  // Compare dates
  if (now >= overdueDate) {
    return 'Overdue';
  } else {
    return 'Due';
  }
  
  // Fallback (should not reach here)
  return '';
}

// Helper function to sync variable task to RH records
async function syncVariableTaskToRHRecords(task: any, oldTask?: any) {
  try {
    // Only sync if task is submitted (not draft)
    if (task.isDraft) {
      return;
    }

    // Parse crew involved details
    let crewDetails: any = {};
    try {
      crewDetails = JSON.parse(task.crewInvolvedDetails || '{}');
    } catch (e) {
      console.error('Failed to parse crew details:', e);
      return;
    }

    const crewArray = crewDetails.crew || [];
    if (crewArray.length === 0) {
      return;
    }

    // Parse task dates and times (format: "04-Oct-2025 / 10:00")
    const [startDateStr, startTimeStr] = task.startDateTime.split(' / ');
    const [finishDateStr, finishTimeStr] = task.finishDateTime.split(' / ');

    // Parse date from DD-MMM-YYYY format
    const parseTaskDate = (dateStr: string) => {
      const [day, monthStr, year] = dateStr.split('-');
      const monthMap: Record<string, number> = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      return new Date(parseInt(year), monthMap[monthStr], parseInt(day));
    };

    const startDate = parseTaskDate(startDateStr);
    const finishDate = parseTaskDate(finishDateStr);

    const startCell = timeToCell(startTimeStr);
    // For finish time, if it's on the hour (e.g., 14:00), mark up to the previous cell
    // because the task ends at that time, not after it
    const [finishHours, finishMinutes] = finishTimeStr.split(':').map(Number);
    let finishCell = timeToCell(finishTimeStr);
    if (finishMinutes === 0 && finishCell > 0) {
      finishCell = finishCell - 1;
    }

    const isPlan = task.statusType === 'planned';

    // If editing, remove old 'a' codes for planned tasks
    if (oldTask && !oldTask.isDraft && oldTask.statusType === 'planned') {
      await removeVariableTaskFromRHRecords(oldTask);
    }

    // Process each crew member
    for (const crew of crewArray) {
      // Process each day in the task date range
      let currentDate = new Date(startDate);
      
      while (currentDate <= finishDate) {
        // Skip this day if it's the finish date and task ends at midnight (00:00)
        // This prevents marking the next day when task actually ends on previous day
        if (currentDate.getTime() === finishDate.getTime() && finishCell === 0) {
          break;
        }

        const monthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const day = currentDate.getDate();

        // Get or create RH daily record for this crew member
        let rhRecord = await storage.getRestHoursDailyRecordByKey(crew.id, task.vesselId, monthYear);
        
        if (!rhRecord) {
          // Create new record if it doesn't exist
          const crewMembers = await storage.getCrewMembers();
          const crewMember = crewMembers.find(c => c.id === crew.id);
          
          if (!crewMember) {
            continue;
          }

          // Initialize all days of the month to prevent partial form display
          const [year, month] = monthYear.split('-').map(Number);
          const daysInMonth = new Date(year, month, 0).getDate();
          const initialDailyRecords = Array.from({ length: daysInMonth }, (_, i) => {
            const dayDate = new Date(year, month - 1, i + 1);
            return {
              day: i + 1,
              dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayDate.getDay()],
              hours: Array(48).fill(''),
              isPlan: false,
              comments: '',
              violations: []
            };
          });

          rhRecord = await storage.createRestHoursDailyRecord({
            crewMemberId: crew.id,
            vesselId: task.vesselId,
            rank: crew.rank,
            name: crew.name,
            monthYear,
            dailyRecords: JSON.stringify(initialDailyRecords)
          });
        }

        // Parse daily records
        let dailyRecords: any[] = [];
        try {
          dailyRecords = JSON.parse(rhRecord.dailyRecords);
        } catch (e) {
          dailyRecords = [];
        }

        // Find or create the day record
        let dayRecord = dailyRecords.find((d: any) => d.day === day);
        if (!dayRecord) {
          dayRecord = {
            day,
            dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][currentDate.getDay()],
            hours: Array(48).fill(''),
            isPlan,
            comments: '',
            violations: []
          };
          dailyRecords.push(dayRecord);
        }

        // Determine cell range for this day
        let dayCellStart = 0;
        let dayCellEnd = 47;

        if (currentDate.getTime() === startDate.getTime()) {
          dayCellStart = startCell;
        }
        if (currentDate.getTime() === finishDate.getTime()) {
          dayCellEnd = finishCell;
        }

        // Update hours array with 'a' code (only if not 'w' or 'd')
        for (let cellIdx = dayCellStart; cellIdx <= dayCellEnd; cellIdx++) {
          const currentCode = dayRecord.hours[cellIdx];
          // Only add 'a' if cell is empty or already 'a' (don't overwrite 'w' or 'd')
          if (currentCode !== 'w' && currentCode !== 'd') {
            dayRecord.hours[cellIdx] = 'a';
          }
        }

        // Update isPlan to match task status
        dayRecord.isPlan = isPlan;

        // Save updated record
        await storage.updateRestHoursDailyRecord(rhRecord.id, {
          dailyRecords: JSON.stringify(dailyRecords)
        });

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    
    // Recalculate activity conflicts for this vessel/month after syncing
    await recalculateActivityConflicts(task.vesselId, task.periodValue);
  } catch (error) {
    console.error('Failed to sync variable task to RH records:', error);
  }
}

// Helper function to remove variable task from RH records (for planned tasks only)
async function removeVariableTaskFromRHRecords(task: any) {
  try {
    // Only remove if task is planned (completed tasks can only be removed manually)
    if (task.statusType !== 'planned') {
      return;
    }

    // Parse crew involved details
    let crewDetails: any = {};
    try {
      crewDetails = JSON.parse(task.crewInvolvedDetails || '{}');
    } catch (e) {
      return;
    }

    const crewArray = crewDetails.crew || [];
    if (crewArray.length === 0) {
      return;
    }

    // Parse task dates and times (format: "04-Oct-2025 / 10:00")
    const [startDateStr, startTimeStr] = task.startDateTime.split(' / ');
    const [finishDateStr, finishTimeStr] = task.finishDateTime.split(' / ');

    // Parse date from DD-MMM-YYYY format
    const parseTaskDate = (dateStr: string) => {
      const [day, monthStr, year] = dateStr.split('-');
      const monthMap: Record<string, number> = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      return new Date(parseInt(year), monthMap[monthStr], parseInt(day));
    };

    const startDate = parseTaskDate(startDateStr);
    const finishDate = parseTaskDate(finishDateStr);

    const startCell = timeToCell(startTimeStr);
    // For finish time, if it's on the hour (e.g., 14:00), mark up to the previous cell
    const [finishHours, finishMinutes] = finishTimeStr.split(':').map(Number);
    let finishCell = timeToCell(finishTimeStr);
    if (finishMinutes === 0 && finishCell > 0) {
      finishCell = finishCell - 1;
    }

    // Process each crew member
    for (const crew of crewArray) {
      let currentDate = new Date(startDate);
      
      while (currentDate <= finishDate) {
        // Skip this day if it's the finish date and task ends at midnight (00:00)
        if (currentDate.getTime() === finishDate.getTime() && finishCell === 0) {
          break;
        }

        const monthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const day = currentDate.getDate();

        const rhRecord = await storage.getRestHoursDailyRecordByKey(crew.id, task.vesselId, monthYear);
        
        if (!rhRecord) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        let dailyRecords: any[] = [];
        try {
          dailyRecords = JSON.parse(rhRecord.dailyRecords);
        } catch (e) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        const dayRecord = dailyRecords.find((d: any) => d.day === day);
        if (!dayRecord) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        // Determine cell range for this day
        let dayCellStart = 0;
        let dayCellEnd = 47;

        if (currentDate.getTime() === startDate.getTime()) {
          dayCellStart = startCell;
        }
        if (currentDate.getTime() === finishDate.getTime()) {
          dayCellEnd = finishCell;
        }

        // Remove 'a' codes (set to empty string)
        for (let cellIdx = dayCellStart; cellIdx <= dayCellEnd; cellIdx++) {
          if (dayRecord.hours[cellIdx] === 'a') {
            dayRecord.hours[cellIdx] = '';
          }
        }

        // Save updated record
        await storage.updateRestHoursDailyRecord(rhRecord.id, {
          dailyRecords: JSON.stringify(dailyRecords)
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
  } catch (error) {
    console.error('Failed to remove variable task from RH records:', error);
  }
}

// Helper function to recalculate activity conflicts for a vessel/month
async function recalculateActivityConflicts(vesselId: string, monthYear: string) {
  try {
    console.log(`🔍 Recalculating activity conflicts for vessel ${vesselId}, month ${monthYear}`);
    
    // Get all COMPLETED variable tasks for this vessel and month
    const allTasks = await storage.getVariableTasksByFilters({ vesselId, periodValue: monthYear });
    const completedTasks = allTasks.filter(task => 
      !task.isDraft && 
      task.statusType === 'completed'
    );
    
    if (completedTasks.length === 0) {
      console.log('No completed tasks found - no conflicts possible');
      
      // Update vessel record to clear conflicts
      const vesselRecords = await storage.getRestHoursVesselRecords();
      const vesselRecord = vesselRecords.find(r => r.vesselId === vesselId && r.monthValue === monthYear);
      if (vesselRecord) {
        await storage.updateRestHoursVesselRecord(vesselRecord.id, {
          activityConflicting: false,
          crewWithActivityConflicts: 0,
          crewWithActivityConflictsDetails: null
        });
      }
      
      // Also clear crew-level records to prevent stuck flags
      const crewRecords = await storage.getRestHoursCrewRecords();
      for (const crewRecord of crewRecords) {
        if (crewRecord.vesselId === vesselId && crewRecord.monthValue === monthYear) {
          await storage.updateRestHoursCrewRecord(crewRecord.id, {
            activityConflicting: false
          });
        }
      }
      
      return;
    }
    
    console.log(`Found ${completedTasks.length} completed tasks to check`);
    
    // Prefetch all RH daily records for this vessel/month to avoid repeated storage calls
    const allDailyRecords = await storage.getRestHoursDailyRecords();
    const rhRecordsCache = new Map<string, { record: any; dailyRecords: any[] }>();
    
    for (const record of allDailyRecords) {
      if (record.vesselId === vesselId && record.monthYear === monthYear) {
        const cacheKey = `${record.crewMemberId}-${monthYear}`;
        try {
          const dailyRecords = JSON.parse(record.dailyRecords);
          rhRecordsCache.set(cacheKey, { record, dailyRecords });
        } catch (e) {
          console.error(`Failed to parse dailyRecords for crew ${record.crewMemberId} - treating as conflict`);
          // Treat parse failures as missing data = conflict
          rhRecordsCache.set(cacheKey, { record, dailyRecords: [] });
        }
      }
    }
    
    // Track crew members with conflicts
    const crewConflictsMap = new Map<string, { name: string; rank: string }>();
    
    // Process each completed task
    for (const task of completedTasks) {
      // Parse crew involved details
      let crewDetails: any = {};
      try {
        crewDetails = JSON.parse(task.crewInvolvedDetails || '{}');
      } catch (e) {
        console.error('Failed to parse crew details:', e);
        continue;
      }
      
      const crewArray = crewDetails.crew || [];
      if (crewArray.length === 0) {
        continue;
      }
      
      // Parse task dates and times (format: "04-Oct-2025 / 10:00")
      const [startDateStr, startTimeStr] = task.startDateTime.split(' / ');
      const [finishDateStr, finishTimeStr] = task.finishDateTime.split(' / ');
      
      // Parse date from DD-MMM-YYYY format
      const parseTaskDate = (dateStr: string) => {
        const [day, monthStr, year] = dateStr.split('-');
        const monthMap: Record<string, number> = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };
        return new Date(parseInt(year), monthMap[monthStr], parseInt(day));
      };
      
      const startDate = parseTaskDate(startDateStr);
      const finishDate = parseTaskDate(finishDateStr);
      
      const startCell = timeToCell(startTimeStr);
      const [finishHours, finishMinutes] = finishTimeStr.split(':').map(Number);
      let finishCell = timeToCell(finishTimeStr);
      if (finishMinutes === 0 && finishCell > 0) {
        finishCell = finishCell - 1;
      }
      
      // Check each crew member
      for (const crew of crewArray) {
        // Process each day in the task date range
        let currentDate = new Date(startDate);
        let hasConflict = false;
        
        while (currentDate <= finishDate && !hasConflict) {
          // Skip this day if it's the finish date and task ends at midnight (00:00)
          if (currentDate.getTime() === finishDate.getTime() && finishCell === 0) {
            break;
          }
          
          const taskMonthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
          const day = currentDate.getDate();
          
          // Get cached RH daily record for this crew member (or fetch if not cached for cross-month tasks)
          const cacheKey = `${crew.id}-${taskMonthYear}`;
          let cachedData = rhRecordsCache.get(cacheKey);
          
          // If not in cache (e.g., task spans multiple months), fetch and cache it
          if (!cachedData) {
            const rhRecord = await storage.getRestHoursDailyRecordByKey(crew.id, vesselId, taskMonthYear);
            if (!rhRecord) {
              // No RH record exists = conflict
              hasConflict = true;
              break;
            }
            
            try {
              const dailyRecords = JSON.parse(rhRecord.dailyRecords);
              cachedData = { record: rhRecord, dailyRecords };
              rhRecordsCache.set(cacheKey, cachedData);
            } catch (e) {
              console.error(`Failed to parse dailyRecords for crew ${crew.id} - treating as conflict`);
              // Corrupted data = conflict
              hasConflict = true;
              break;
            }
          }
          
          if (cachedData.dailyRecords.length === 0) {
            // Empty or corrupted data = conflict
            hasConflict = true;
            break;
          }
          
          const dayRecord = cachedData.dailyRecords.find((d: any) => d.day === day);
          if (!dayRecord) {
            // No day record = conflict
            hasConflict = true;
            break;
          }
          
          // Determine cell range for this day
          let dayCellStart = 0;
          let dayCellEnd = 47;
          
          if (currentDate.getTime() === startDate.getTime()) {
            dayCellStart = startCell;
          }
          if (currentDate.getTime() === finishDate.getTime()) {
            dayCellEnd = finishCell;
          }
          
          // Check if any cells in the task time range are blank (rest)
          for (let cellIdx = dayCellStart; cellIdx <= dayCellEnd; cellIdx++) {
            const code = dayRecord.hours[cellIdx];
            // Blank/empty = rest, which conflicts with a completed task
            // Work codes are: 'a', 'w', 'd'
            if (!code || code === '') {
              hasConflict = true;
              break;
            }
          }
          
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // Add to conflicts map if conflict found
        if (hasConflict) {
          crewConflictsMap.set(crew.id, {
            name: crew.name,
            rank: crew.rank
          });
        }
      }
    }
    
    // Prepare conflict details
    const crewWithConflicts = Array.from(crewConflictsMap.values());
    const hasConflicts = crewWithConflicts.length > 0;
    const conflictDetailsJson = hasConflicts ? JSON.stringify(crewWithConflicts) : null;
    
    console.log(`Conflicts found: ${hasConflicts}, Crew count: ${crewWithConflicts.length}`);
    
    // Update vessel record with conflict status
    const vesselRecords = await storage.getRestHoursVesselRecords();
    const vesselRecord = vesselRecords.find(r => r.vesselId === vesselId && r.monthValue === monthYear);
    
    if (vesselRecord) {
      await storage.updateRestHoursVesselRecord(vesselRecord.id, {
        activityConflicting: hasConflicts,
        crewWithActivityConflicts: crewWithConflicts.length,
        crewWithActivityConflictsDetails: conflictDetailsJson
      });
      console.log(`✅ Updated vessel record with conflict status`);
    }
    
    // Also update crew-level records
    const crewRecords = await storage.getRestHoursCrewRecords();
    for (const crewRecord of crewRecords) {
      if (crewRecord.vesselId === vesselId && crewRecord.monthValue === monthYear) {
        const crewHasConflict = crewConflictsMap.has(crewRecord.crewMemberId);
        await storage.updateRestHoursCrewRecord(crewRecord.id, {
          activityConflicting: crewHasConflict
        });
      }
    }
    
  } catch (error) {
    console.error('Failed to recalculate activity conflicts:', error);
  }
}

// Helper function to clear plan codes for a specific crew member when Fixed Task is deleted
async function clearFixedTaskPlanCodes(crewMemberId: string, vesselId: string, monthYear: string) {
  try {
    console.log(`🧹 Clearing Fixed Task plan codes for crew ${crewMemberId}, vessel ${vesselId}, month ${monthYear}`);
    
    // Get RH daily record for this crew member
    const rhRecord = await storage.getRestHoursDailyRecordByKey(crewMemberId, vesselId, monthYear);
    
    if (!rhRecord) {
      console.log('No RH record found - nothing to clear');
      return;
    }

    // Parse daily records
    let dailyRecords: any[] = [];
    try {
      dailyRecords = JSON.parse(rhRecord.dailyRecords);
    } catch (e) {
      console.warn(`Failed to parse dailyRecords for crew ${crewMemberId}`);
      return;
    }

    // Clear all plan codes (reset to empty) for each day
    let clearedAnyDay = false;
    for (const dayRecord of dailyRecords) {
      if (dayRecord.isPlan === true) {
        // Clear all work codes for plan days
        for (let cellIdx = 0; cellIdx < 48; cellIdx++) {
          if (dayRecord.hours[cellIdx] !== '') {
            dayRecord.hours[cellIdx] = '';
            clearedAnyDay = true;
          }
        }
      }
    }

    // Save updated record if anything changed
    if (clearedAnyDay) {
      await storage.updateRestHoursDailyRecord(rhRecord.id, {
        dailyRecords: JSON.stringify(dailyRecords)
      });
      console.log(`✅ Cleared Fixed Task plan codes for crew ${crewMemberId}`);
    }
  } catch (error) {
    console.error('❌ Failed to clear Fixed Task plan codes:', error);
  }
}

// Helper function to sync Fixed Tasks to RH records
async function syncFixedTasksToRHRecords(vesselId: string, monthYear: string) {
  try {
    console.log(`🔄 Syncing Fixed Tasks for vessel ${vesselId}, month ${monthYear}`);
    
    // Get all fixed tasks for this vessel and month
    const fixedTasks = await storage.getFixedTasksByVesselAndMonth(vesselId, monthYear);
    
    if (!fixedTasks || fixedTasks.length === 0) {
      console.log('No fixed tasks found for sync');
      return;
    }

    // Parse monthYear to get date info
    const [year, month] = monthYear.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    console.log(`📅 Processing ${fixedTasks.length} crew members for ${daysInMonth} days`);

    // Process each crew member's fixed task
    for (const fixedTask of fixedTasks) {
      // Parse the seaHours template (default to Sea, Port toggle will be added later)
      let seaHoursTemplate: string[] = [];
      try {
        // Handle potential malformed JSON or empty data
        const seaHoursData = fixedTask.seaHours;
        
        // Skip if empty or null
        if (!seaHoursData) {
          console.log(`Skipping crew ${fixedTask.crewMemberId} - empty seaHours`);
          continue;
        }
        
        // Handle both array (already parsed) and string (JSON) formats
        if (Array.isArray(seaHoursData)) {
          // Already an array - use directly
          seaHoursTemplate = seaHoursData;
        } else if (typeof seaHoursData === 'string') {
          // String - need to parse as JSON
          if (seaHoursData.trim() === '') {
            console.log(`Skipping crew ${fixedTask.crewMemberId} - empty seaHours string`);
            continue;
          }
          seaHoursTemplate = JSON.parse(seaHoursData);
        } else {
          console.warn(`Unexpected seaHours type for crew ${fixedTask.crewMemberId}: ${typeof seaHoursData}`);
          continue;
        }
        
        // Validate array structure
        if (!Array.isArray(seaHoursTemplate) || seaHoursTemplate.length !== 48) {
          console.warn(`Invalid seaHours template for crew ${fixedTask.crewMemberId} - expected array of 48, got ${Array.isArray(seaHoursTemplate) ? seaHoursTemplate.length : 'not an array'}`);
          continue;
        }
        
        // REMOVED: Don't skip if template is all empty - we need to clear existing plan codes
        // Users can edit Fixed Tasks to remove codes, and sync must clear those codes in RH Recording
        
      } catch (e) {
        console.warn(`Failed to parse seaHours for crew ${fixedTask.crewMemberId}:`, e);
        const debugData = typeof fixedTask.seaHours === 'string' 
          ? fixedTask.seaHours.substring(0, 100)
          : `[${typeof fixedTask.seaHours}]`;
        console.warn(`Raw seaHours data: ${debugData}`);
        continue;
      }

      // Get or create RH daily record for this crew member
      let rhRecord = await storage.getRestHoursDailyRecordByKey(
        fixedTask.crewMemberId, 
        vesselId, 
        monthYear
      );

      // Create record if it doesn't exist
      if (!rhRecord) {
        const initialDailyRecords = Array.from({ length: daysInMonth }, (_, i) => {
          const dayDate = new Date(year, month - 1, i + 1);
          return {
            day: i + 1,
            dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayDate.getDay()],
            hours: Array(48).fill(''),
            isPlan: true,
            comments: '',
            violations: []
          };
        });

        rhRecord = await storage.createRestHoursDailyRecord({
          crewMemberId: fixedTask.crewMemberId,
          vesselId,
          rank: fixedTask.rank,
          name: fixedTask.name,
          monthYear,
          dailyRecords: JSON.stringify(initialDailyRecords)
        });
      }

      // Parse daily records
      let dailyRecords: any[] = [];
      try {
        dailyRecords = JSON.parse(rhRecord.dailyRecords);
      } catch (e) {
        console.warn(`Failed to parse dailyRecords for crew ${fixedTask.crewMemberId}`);
        continue;
      }

      // Apply Fixed Task template to ALL days of the month
      let updatedAnyDay = false;
      
      for (let day = 1; day <= daysInMonth; day++) {
        // Find or create day record
        let dayRecord = dailyRecords.find((d: any) => d.day === day);
        
        if (!dayRecord) {
          const dayDate = new Date(year, month - 1, day);
          dayRecord = {
            day,
            dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayDate.getDay()],
            hours: Array(48).fill(''),
            isPlan: true,
            comments: '',
            violations: []
          };
          dailyRecords.push(dayRecord);
        }

        // Track whether we modified any cells for THIS day
        let modifiedThisDay = false;

        // Apply template to each half-hour slot (0-47)
        for (let cellIdx = 0; cellIdx < 48; cellIdx++) {
          const templateValue = seaHoursTemplate[cellIdx];
          const currentValue = dayRecord.hours[cellIdx];
          
          // Smart overwrite logic for Fixed Tasks:
          // - If day is PLAN (isPlan: true): Overwrite ALL cells with template (including clearing codes)
          // - If day is COMPLETED (isPlan: false): NEVER overwrite - user has manually recorded data
          // - Variable task codes ('a') from plan are also overwritten by Fixed Task template
          
          const shouldOverwrite = dayRecord.isPlan === true;

          if (shouldOverwrite && templateValue !== currentValue) {
            dayRecord.hours[cellIdx] = templateValue;
            modifiedThisDay = true;
            updatedAnyDay = true;
          }
        }
        
        // Only mark this day as plan if we actually modified cells
        // This preserves completed days (isPlan: false) that weren't touched
        if (modifiedThisDay && dayRecord.isPlan !== true) {
          dayRecord.isPlan = true;
        }
      }

      // Save updated record only if something changed
      if (updatedAnyDay) {
        await storage.updateRestHoursDailyRecord(rhRecord.id, {
          dailyRecords: JSON.stringify(dailyRecords)
        });
        console.log(`✅ Synced Fixed Tasks for crew ${fixedTask.name}`);
      }
    }

    console.log(`✅ Fixed Tasks sync completed for vessel ${vesselId}, month ${monthYear}`);
  } catch (error) {
    console.error('❌ Failed to sync Fixed Tasks to RH records:', error);
  }
}

// Helper function to calculate recording percentage based on daily records
function calculateRecordingPercentage(dailyRecordsJson: string, monthYear: string): number {
  try {
    const dailyRecords = JSON.parse(dailyRecordsJson);
    if (!Array.isArray(dailyRecords) || dailyRecords.length === 0) {
      return 0;
    }

    // Get the number of days in the month
    const [year, month] = monthYear.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Count days that have been filled (not plan entries)
    const filledDays = dailyRecords.filter((day: any) => {
      // A day is "filled" if it's NOT a plan (isPlan = false or undefined for actual recordings)
      // AND has at least one non-empty hour entry
      const isPlan = day.isPlan === true;
      const hasHours = Array.isArray(day.hours) && day.hours.some((h: string) => h !== '');
      
      return !isPlan && hasHours;
    }).length;

    // Calculate percentage
    const percentage = Math.round((filledDays / daysInMonth) * 100);
    return Math.min(100, Math.max(0, percentage));
  } catch (error) {
    console.error('Failed to calculate recording percentage:', error);
    return 0;
  }
}

// Helper function to filter violations based on compliance mode
function filterViolationsByMode(violations: number[], complianceMode: 'Rest' | 'Work', opaMode: boolean): number[] {
  const visibleCodes: number[] = [];
  
  // Add codes based on compliance mode
  if (complianceMode === 'Rest') {
    visibleCodes.push(1, 2, 3, 4); // Rest mode violations
  } else {
    visibleCodes.push(5, 6); // Work mode violations
  }
  
  // Add OPA codes if OPA mode is enabled
  if (opaMode) {
    visibleCodes.push(7, 8);
  }
  
  return violations.filter(v => visibleCodes.includes(v));
}

// Helper function to count violation days based on compliance mode
function countViolationDays(dailyRecordsJson: string, complianceMode: 'Rest' | 'Work', opaMode: boolean, isPlanMode: boolean): number {
  try {
    const dailyRecords = JSON.parse(dailyRecordsJson);
    if (!Array.isArray(dailyRecords) || dailyRecords.length === 0) {
      return 0;
    }

    // Count days with violations
    const violationDays = dailyRecords.filter((day: any) => {
      // Filter by isPlan status
      const dayIsPlan = day.isPlan === true;
      if (isPlanMode !== dayIsPlan) {
        return false;
      }
      
      // Check if day has violations
      if (!Array.isArray(day.violations) || day.violations.length === 0) {
        return false;
      }
      
      // Filter violations based on compliance mode
      const relevantViolations = filterViolationsByMode(day.violations, complianceMode, opaMode);
      
      // Count as 1 if there are any relevant violations (regardless of how many)
      return relevantViolations.length > 0;
    }).length;

    return violationDays;
  } catch (error) {
    console.error('Failed to count violation days:', error);
    return 0;
  }
}

// Helper function to check if a crew member has any violation days
function hasViolationDays(dailyRecordsJson: string, complianceMode: 'Rest' | 'Work', opaMode: boolean, isPlanMode: boolean): boolean {
  try {
    const dailyRecords = JSON.parse(dailyRecordsJson);
    if (!Array.isArray(dailyRecords) || dailyRecords.length === 0) {
      return false;
    }

    // Check if any day has violations
    return dailyRecords.some((day: any) => {
      // Filter by isPlan status
      const dayIsPlan = day.isPlan === true;
      if (isPlanMode !== dayIsPlan) {
        return false;
      }
      
      // Check if day has violations
      if (!Array.isArray(day.violations) || day.violations.length === 0) {
        return false;
      }
      
      // Filter violations based on compliance mode
      const relevantViolations = filterViolationsByMode(day.violations, complianceMode, opaMode);
      
      // Return true if there are any relevant violations
      return relevantViolations.length > 0;
    });
  } catch (error) {
    console.error('Failed to check violation days:', error);
    return false;
  }
}

// Helper function to get array of dates (day numbers) where violations occurred
function getViolationDates(dailyRecordsJson: string, complianceMode: 'Rest' | 'Work', opaMode: boolean, isPlanMode: boolean): number[] {
  try {
    const dailyRecords = JSON.parse(dailyRecordsJson);
    if (!Array.isArray(dailyRecords) || dailyRecords.length === 0) {
      return [];
    }

    // Collect day numbers where violations occurred
    const violationDates: number[] = [];
    dailyRecords.forEach((day: any) => {
      // Filter by isPlan status
      const dayIsPlan = day.isPlan === true;
      if (isPlanMode !== dayIsPlan) {
        return;
      }
      
      // Check if day has violations
      if (!Array.isArray(day.violations) || day.violations.length === 0) {
        return;
      }
      
      // Filter violations based on compliance mode
      const relevantViolations = filterViolationsByMode(day.violations, complianceMode, opaMode);
      
      // Add day number if there are relevant violations
      if (relevantViolations.length > 0 && day.day) {
        violationDates.push(day.day);
      }
    });

    return violationDates.sort((a, b) => a - b); // Sort dates in ascending order
  } catch (error) {
    console.error('Failed to get violation dates:', error);
    return [];
  }
}

// Helper function to check if daily records contain Code [2] violations
function hasCode2Violation(dailyRecordsJson: string, complianceMode: 'Rest' | 'Work', opaMode: boolean, isPlanMode: boolean): boolean {
  try {
    const dailyRecords = JSON.parse(dailyRecordsJson);
    if (!Array.isArray(dailyRecords) || dailyRecords.length === 0) {
      return false;
    }

    // Check if any day has Code [2] violation
    return dailyRecords.some((day: any) => {
      // Filter by isPlan status
      const dayIsPlan = day.isPlan === true;
      if (isPlanMode !== dayIsPlan) {
        return false;
      }
      
      // Check if day has violations
      if (!Array.isArray(day.violations) || day.violations.length === 0) {
        return false;
      }
      
      // Filter violations based on compliance mode
      const relevantViolations = filterViolationsByMode(day.violations, complianceMode, opaMode);
      
      // Check if Code [2] is present in relevant violations
      return relevantViolations.includes(2);
    });
  } catch (error) {
    console.error('Failed to check Code [2] violation:', error);
    return false;
  }
}

// Helper function to calculate NC (Non-Conformance) for a crew member
// Returns {totalNCs: number, predictedNCs: number}
function calculateNCs(dailyRecordsJson: string, complianceMode: 'Rest' | 'Work', opaMode: boolean): { totalNCs: number; predictedNCs: number } {
  try {
    // Count completed violation days
    const completedViolationDays = countViolationDays(dailyRecordsJson, complianceMode, opaMode, false);
    // Check for Code [2] in completed records
    const hasCompletedCode2 = hasCode2Violation(dailyRecordsJson, complianceMode, opaMode, false);
    
    // Determine if there's a completed NC
    const hasCompletedNC = completedViolationDays >= 3 || hasCompletedCode2;
    
    if (hasCompletedNC) {
      // If there's a completed NC, return it and no predicted NC
      return { totalNCs: 1, predictedNCs: 0 };
    }
    
    // No completed NC - check for predicted NC
    const predictedViolationDays = countViolationDays(dailyRecordsJson, complianceMode, opaMode, true);
    const combinedViolationDays = completedViolationDays + predictedViolationDays;
    
    // Check for Code [2] in predicted records
    const hasPredictedCode2 = hasCode2Violation(dailyRecordsJson, complianceMode, opaMode, true);
    
    // Predicted NC occurs if: combined days >= 3 OR Code [2] in predicted
    const hasPredictedNC = combinedViolationDays >= 3 || hasPredictedCode2;
    
    return { totalNCs: 0, predictedNCs: hasPredictedNC ? 1 : 0 };
  } catch (error) {
    console.error('Failed to calculate NCs:', error);
    return { totalNCs: 0, predictedNCs: 0 };
  }
}

// Helper function to update crew and vessel recording percentages
async function updateRecordingPercentages(crewMemberId: string, vesselId: string, monthYear: string) {
  try {
    // Get the daily record
    const dailyRecord = await storage.getRestHoursDailyRecordByKey(crewMemberId, vesselId, monthYear);
    if (!dailyRecord) {
      return;
    }

    // Calculate the recording percentage
    const recordingPercent = calculateRecordingPercentage(dailyRecord.dailyRecords, monthYear);

    // Find existing crew record by filtering
    const crewRecords = await storage.getRestHoursCrewRecordsByFilters({
      vesselIds: [vesselId],
      monthValue: monthYear
    });
    
    const existingCrewRecord = crewRecords.find(r => r.crewMemberId === crewMemberId);
    
    if (existingCrewRecord) {
      await storage.updateRestHoursCrewRecord(existingCrewRecord.id, {
        recordingStatusPercent: recordingPercent
      });
    } else {
      // Create crew record if it doesn't exist
      await storage.createRestHoursCrewRecord({
        crewMemberId,
        vesselId,
        vesselName: '', // Will be enriched by API
        rank: dailyRecord.rank,
        name: dailyRecord.name,
        monthValue: monthYear,
        month: formatMonthDisplay(monthYear),
        signOnOffInfo: '',
        recordingStatusPercent: recordingPercent,
        activityConflicting: false,
        totalViolations: 0,
        totalNCs: 0,
        predictedViolations: 0,
        predictedNCs: 0,
      });
    }

    // Update vessel-level aggregate
    await updateVesselRecordingPercentage(vesselId, monthYear);
  } catch (error) {
    console.error('Failed to update recording percentages:', error);
  }
}

// Helper function to format month display
function formatMonthDisplay(monthValue: string): string {
  if (!monthValue) return '';
  const [year, month] = monthValue.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIndex = parseInt(month) - 1;
  return `${monthNames[monthIndex]}-${year}`;
}

// Helper function to update vessel-level recording percentage
async function updateVesselRecordingPercentage(vesselId: string, monthValue: string) {
  try {
    // Get all crew records for this vessel and month
    const crewRecords = await storage.getRestHoursCrewRecordsByFilters({
      vesselIds: [vesselId],
      monthValue
    });

    if (crewRecords.length === 0) {
      return;
    }

    // Calculate average recording percentage across all crew
    const totalPercent = crewRecords.reduce((sum, record) => sum + (record.recordingStatusPercent || 0), 0);
    const averagePercent = Math.round(totalPercent / crewRecords.length);

    // Find existing vessel record by filtering
    const vesselRecords = await storage.getRestHoursVesselRecordsByFilters({
      vesselIds: [vesselId],
      monthValue
    });
    
    const existingVesselRecord = vesselRecords.find(r => r.vesselId === vesselId && r.monthValue === monthValue);
    
    if (existingVesselRecord) {
      await storage.updateRestHoursVesselRecord(existingVesselRecord.id, {
        recordingStatusPercent: averagePercent
      });
    } else {
      // Fetch vessel name from master data
      const vesselMasterData = await storage.getMasterDataEntries('014');
      const vessel = vesselMasterData?.find((v: any) => {
        const entryId = v.entryId || v.entry_id;
        return entryId === vesselId;
      });
      const vesselName = vessel?.name || '';
      
      // Create vessel record if it doesn't exist
      await storage.createRestHoursVesselRecord({
        vesselId,
        vesselName,
        monthValue,
        month: formatMonthDisplay(monthValue),
        totalCrew: crewRecords.length,
        recordingStatusPercent: averagePercent,
        activityConflicting: false,
        totalViolations: 0,
        crewWithViolations: 0,
        totalNCs: 0,
        crewWithNCs: 0,
        predictedViolations: 0,
        predictedNCs: 0,
        officeReviewStatus: calculateOfficeReviewStatus(monthValue, null, null),
      });
    }
  } catch (error) {
    console.error('Failed to update vessel recording percentage:', error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint for database connectivity
  app.get("/api/health", async (req, res) => {
    const healthStatus = {
      server: "running",
      database: isConnected ? "connected" : "disconnected",
      // Gate sensitive information behind development environment check
      ...(process.env.NODE_ENV === 'development' && {
        rds_instance: "ls-d153072fe29fcd7dc7c484a33fd3130e29abae1b.cxock8yskd1i.ap-southeast-1.rds.amazonaws.com:3306",
        database_name: "crew_database"
      }),
      connection_error: connectionError?.message || null,
      timestamp: new Date().toISOString()
    };

    if (isConnected) {
      try {
        // Test with actual query
        await storage.getForms();
        res.status(200).json({ 
          status: "healthy", 
          ...healthStatus
        });
      } catch (error) {
        res.status(500).json({ 
          status: "unhealthy - query failed", 
          ...healthStatus,
          query_error: error instanceof Error ? error.message : String(error)
        });
      }
    } else {
      res.status(500).json({ 
        status: "unhealthy - no database connection", 
        ...healthStatus,
        troubleshooting: {
          check_security_groups: "Ensure RDS security group allows connections from this environment",
          check_database_exists: "Verify 'crew_database' database exists on RDS instance",
          check_credentials: "Verify DB_USER and DB_PASSWORD are correct",
          check_network: "Ensure network connectivity to RDS endpoint"
        }
      });
    }
  });

  // Database connectivity test endpoint
  app.get("/api/db-test", async (req, res) => {
    try {
      const startTime = Date.now();
      await storage.getForms();
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      res.status(200).json({ 
        message: "Database connection successful",
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Database test failed:", error);
      res.status(500).json({ 
        error: "Database connection failed",
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  });

  // Forms API routes
  app.get("/api/forms", async (req, res) => {
    try {
      const forms = await storage.getForms();
      res.json(forms);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch forms" });
    }
  });

  app.get("/api/forms/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const form = await storage.getForm(id);
      if (!form) {
        return res.status(404).json({ error: "Form not found" });
      }
      res.json(form);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch form" });
    }
  });

  app.post("/api/forms", async (req, res) => {
    try {
      const result = insertFormSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid form data", details: result.error.issues });
      }
      const form = await storage.createForm(result.data);
      res.json(form);
    } catch (error) {
      res.status(500).json({ error: "Failed to create form" });
    }
  });

  app.put("/api/forms/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertFormSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid form data", details: result.error.issues });
      }
      const form = await storage.updateForm(id, result.data);
      if (!form) {
        return res.status(404).json({ error: "Form not found" });
      }
      res.json(form);
    } catch (error) {
      res.status(500).json({ error: "Failed to update form" });
    }
  });

  app.delete("/api/forms/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteForm(id);
      if (!deleted) {
        return res.status(404).json({ error: "Form not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete form" });
    }
  });

  app.get("/api/forms/for-rank/:rankLabel", async (req, res) => {
    try {
      const rankLabel = req.params.rankLabel;
      const category = req.query.category as string;
      const form = await storage.getFormForRank(rankLabel, category);
      if (!form) {
        return res.status(404).json({ error: "No form configured for this rank" });
      }
      res.json(form);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch form for rank" });
    }
  });

  // Cleanup duplicate forms (admin endpoint)
  app.post("/api/forms/cleanup-duplicates", async (req, res) => {
    try {
      const forms = await storage.getForms();
      const duplicateForms = forms.filter(f => f.name === "Crew Appraisal Form");
      
      if (duplicateForms.length <= 1) {
        return res.json({ 
          message: "No duplicates found", 
          totalForms: duplicateForms.length 
        });
      }

      // Keep the first form (lowest ID), delete the rest
      const formToKeep = duplicateForms.reduce((prev, curr) => 
        prev.id < curr.id ? prev : curr
      );
      const formsToDelete = duplicateForms.filter(f => f.id !== formToKeep.id);
      
      let deletedCount = 0;
      for (const form of formsToDelete) {
        const success = await storage.deleteForm(form.id);
        if (success) {
          deletedCount++;
          console.log(`🗑️ Deleted duplicate form ID: ${form.id}`);
        }
      }

      res.json({ 
        message: "Cleanup completed", 
        kept: formToKeep.id,
        deletedCount,
        totalOriginal: duplicateForms.length 
      });
    } catch (error) {
      console.error("Error cleaning up duplicate forms:", error);
      res.status(500).json({ error: "Failed to cleanup duplicate forms" });
    }
  });

  // Rank Groups API routes
  app.get("/api/rank-groups/:formId", async (req, res) => {
    try {
      const formId = parseInt(req.params.formId);
      const rankGroups = await storage.getRankGroups(formId);
      res.json(rankGroups);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rank groups" });
    }
  });

  app.post("/api/rank-groups", async (req, res) => {
    try {
      console.log('📥 [POST /api/rank-groups] Request body:', JSON.stringify(req.body, null, 2));
      const validatedData = insertRankGroupSchema.parse(req.body);
      console.log('✅ [POST /api/rank-groups] Validation passed:', JSON.stringify(validatedData, null, 2));
      const rankGroup = await storage.createRankGroup(validatedData);
      console.log('✅ [POST /api/rank-groups] Created rank group:', JSON.stringify(rankGroup, null, 2));
      res.status(201).json(rankGroup);
    } catch (error) {
      console.error('❌ [POST /api/rank-groups] Error:', error);
      if (error instanceof z.ZodError) {
        console.error('❌ [POST /api/rank-groups] Validation errors:', JSON.stringify(error.errors, null, 2));
      }
      res.status(400).json({ error: "Invalid rank group data", details: error instanceof z.ZodError ? error.errors : undefined });
    }
  });

  app.put("/api/rank-groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertRankGroupSchema.partial().parse(req.body);
      const rankGroup = await storage.updateRankGroup(id, validatedData);
      if (!rankGroup) {
        return res.status(404).json({ error: "Rank group not found" });
      }
      res.json(rankGroup);
    } catch (error) {
      res.status(400).json({ error: "Invalid rank group data" });
    }
  });

  app.delete("/api/rank-groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteRankGroup(id);
      if (!deleted) {
        return res.status(404).json({ error: "Rank group not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete rank group" });
    }
  });

  // Available Ranks API routes
  app.get("/api/available-ranks", async (req, res) => {
    try {
      const companyOnly = req.query.companyOnly === 'true';
      let ranks = await storage.getAvailableRanks();
      
      // Ranks are already sorted by sortOrder in storage layer (drag-and-drop order)
      // Do NOT re-sort alphabetically here to preserve user-defined rank order
      
      // Filter to only company-applicable ranks if requested
      if (companyOnly) {
        ranks = ranks.filter(rank => rank.applicableToCompany === true);
      }
      
      res.json(ranks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch available ranks" });
    }
  });

  app.post("/api/available-ranks", async (req, res) => {
    try {
      console.log('📥 [POST /api/available-ranks] Request body:', JSON.stringify(req.body, null, 2));
      const validatedData = insertAvailableRankSchema.parse(req.body);
      console.log('✅ [POST /api/available-ranks] Validation passed:', JSON.stringify(validatedData, null, 2));
      const rank = await storage.createAvailableRank(validatedData);
      console.log('✅ [POST /api/available-ranks] Created rank:', JSON.stringify(rank, null, 2));
      res.status(201).json(rank);
    } catch (error) {
      console.error('❌ [POST /api/available-ranks] Error:', error);
      if (error instanceof z.ZodError) {
        console.error('❌ [POST /api/available-ranks] Validation errors:', JSON.stringify(error.errors, null, 2));
      }
      res.status(400).json({ error: "Invalid rank data", details: error instanceof z.ZodError ? error.errors : undefined });
    }
  });

  app.put("/api/available-ranks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertAvailableRankSchema.partial().parse(req.body);
      const rank = await storage.updateAvailableRank(id, validatedData);
      if (!rank) {
        return res.status(404).json({ error: "Rank not found" });
      }
      res.json(rank);
    } catch (error) {
      res.status(400).json({ error: "Invalid rank data" });
    }
  });

  app.delete("/api/available-ranks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteAvailableRank(id);
      if (!deleted) {
        return res.status(404).json({ error: "Rank not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete rank" });
    }
  });

  // Cleanup endpoint to clear all available ranks
  app.delete("/api/available-ranks", async (req, res) => {
    try {
      await storage.clearAllAvailableRanks();
      res.json({ success: true, message: "All ranks cleared successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear ranks" });
    }
  });

  // Rank reorder endpoint for drag-and-drop functionality
  app.post("/api/available-ranks/reorder", async (req, res) => {
    try {
      const validatedData = rankReorderSchema.parse(req.body);
      const success = await storage.updateRankOrders(validatedData);
      if (!success) {
        return res.status(500).json({ error: "Failed to update rank orders" });
      }
      res.json({ success: true, message: "Rank orders updated successfully" });
    } catch (error) {
      console.error('Rank reorder error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid reorder data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to reorder ranks" });
    }
  });

  // Company Ranks endpoints - PERSISTENT STORAGE FOR ROLE ENTRIES!
  app.get("/api/company-ranks", async (req, res) => {
    try {
      const companyRanks = await storage.getCompanyRanks();
      res.json(companyRanks);
    } catch (error) {
      console.error("❌ Failed to fetch company ranks:", error);
      res.status(500).json({ error: "Failed to fetch company ranks" });
    }
  });

  app.post("/api/company-ranks", async (req, res) => {
    try {
      // Use saveAllCompanyRanks for bulk save (frontend sends entire array)
      const companyRanks = await storage.saveAllCompanyRanks(req.body);
      console.log(`💾 [API] Successfully saved ${companyRanks.length} company ranks to persistent storage`);
      res.json({ success: true, data: companyRanks });
    } catch (error) {
      console.error("❌ Failed to save company ranks:", error);
      res.status(500).json({ error: "Failed to save company ranks" });
    }
  });

  // Promotion Hierarchies endpoints
  app.get("/api/promotion-hierarchies", async (req, res) => {
    try {
      const hierarchies = await storage.getPromotionHierarchies();
      // Parse rankPath JSON string to array for frontend
      const parsedHierarchies = hierarchies.map(h => ({
        ...h,
        rankPath: typeof h.rankPath === 'string' ? JSON.parse(h.rankPath) : h.rankPath
      }));
      res.json(parsedHierarchies);
    } catch (error) {
      console.error("❌ Failed to fetch promotion hierarchies:", error);
      res.status(500).json({ error: "Failed to fetch promotion hierarchies" });
    }
  });

  app.get("/api/promotion-hierarchies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const hierarchy = await storage.getPromotionHierarchy(id);
      if (!hierarchy) {
        return res.status(404).json({ error: "Promotion hierarchy not found" });
      }
      // Parse rankPath JSON string to array for frontend
      const parsedHierarchy = {
        ...hierarchy,
        rankPath: typeof hierarchy.rankPath === 'string' ? JSON.parse(hierarchy.rankPath) : hierarchy.rankPath
      };
      res.json(parsedHierarchy);
    } catch (error) {
      console.error("❌ Failed to fetch promotion hierarchy:", error);
      res.status(500).json({ error: "Failed to fetch promotion hierarchy" });
    }
  });

  app.post("/api/promotion-hierarchies", async (req, res) => {
    try {
      const result = insertPromotionHierarchySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid promotion hierarchy data", details: result.error.issues });
      }
      const hierarchy = await storage.createPromotionHierarchy(result.data);
      // Parse rankPath JSON string to array for frontend
      const parsedHierarchy = {
        ...hierarchy,
        rankPath: typeof hierarchy.rankPath === 'string' ? JSON.parse(hierarchy.rankPath) : hierarchy.rankPath
      };
      res.status(201).json(parsedHierarchy);
    } catch (error) {
      console.error("❌ Failed to create promotion hierarchy:", error);
      res.status(500).json({ error: "Failed to create promotion hierarchy" });
    }
  });

  app.patch("/api/promotion-hierarchies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertPromotionHierarchySchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid promotion hierarchy data", details: result.error.issues });
      }
      const hierarchy = await storage.updatePromotionHierarchy(id, result.data);
      if (!hierarchy) {
        return res.status(404).json({ error: "Promotion hierarchy not found" });
      }
      // Parse rankPath JSON string to array for frontend
      const parsedHierarchy = {
        ...hierarchy,
        rankPath: typeof hierarchy.rankPath === 'string' ? JSON.parse(hierarchy.rankPath) : hierarchy.rankPath
      };
      res.json(parsedHierarchy);
    } catch (error) {
      console.error("❌ Failed to update promotion hierarchy:", error);
      res.status(500).json({ error: "Failed to update promotion hierarchy" });
    }
  });

  app.delete("/api/promotion-hierarchies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deletePromotionHierarchy(id);
      if (!success) {
        return res.status(404).json({ error: "Promotion hierarchy not found" });
      }
      res.json({ success: true, message: "Promotion hierarchy deleted successfully" });
    } catch (error) {
      console.error("❌ Failed to delete promotion hierarchy:", error);
      res.status(500).json({ error: "Failed to delete promotion hierarchy" });
    }
  });

  // Company Processing endpoints
  app.get("/api/company-processing", async (req, res) => {
    try {
      const records = await storage.getCompanyProcessingRecords();
      res.json(records);
    } catch (error) {
      console.error("❌ Failed to fetch company processing records:", error);
      res.status(500).json({ error: "Failed to fetch company processing records" });
    }
  });

  app.get("/api/company-processing/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const record = await storage.getCompanyProcessing(id);
      if (!record) {
        return res.status(404).json({ error: "Company processing record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("❌ Failed to fetch company processing record:", error);
      res.status(500).json({ error: "Failed to fetch company processing record" });
    }
  });

  app.get("/api/company-processing/candidate/:candidateId", async (req, res) => {
    try {
      const candidateId = req.params.candidateId;
      const records = await storage.getCompanyProcessingByCandidateId(candidateId);
      res.json(records);
    } catch (error) {
      console.error("❌ Failed to fetch company processing records for candidate:", error);
      res.status(500).json({ error: "Failed to fetch company processing records for candidate" });
    }
  });

  app.post("/api/company-processing", async (req, res) => {
    try {
      const result = insertCompanyProcessingSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid company processing data", details: result.error.issues });
      }
      const record = await storage.createCompanyProcessing(result.data);
      console.log(`✅ [API] Created company processing record ID ${record.id} for candidate ${record.candidateId}`);
      res.status(201).json(record);
    } catch (error) {
      console.error("❌ Failed to create company processing record:", error);
      res.status(500).json({ error: "Failed to create company processing record" });
    }
  });

  app.patch("/api/company-processing/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertCompanyProcessingSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid company processing data", details: result.error.issues });
      }
      const record = await storage.updateCompanyProcessing(id, result.data);
      if (!record) {
        return res.status(404).json({ error: "Company processing record not found" });
      }
      console.log(`✅ [API] Updated company processing record ID ${id}`);
      res.json(record);
    } catch (error) {
      console.error("❌ Failed to update company processing record:", error);
      res.status(500).json({ error: "Failed to update company processing record" });
    }
  });

  app.delete("/api/company-processing/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteCompanyProcessing(id);
      if (!success) {
        return res.status(404).json({ error: "Company processing record not found" });
      }
      console.log(`✅ [API] Deleted company processing record ID ${id}`);
      res.json({ success: true, message: "Company processing record deleted successfully" });
    } catch (error) {
      console.error("❌ Failed to delete company processing record:", error);
      res.status(500).json({ error: "Failed to delete company processing record" });
    }
  });

  // Promotion Forms endpoints
  app.get("/api/promotions", async (req, res) => {
    try {
      const forms = await storage.getPromotionForms();
      res.json(forms);
    } catch (error) {
      console.error("❌ Failed to fetch promotion forms:", error);
      res.status(500).json({ error: "Failed to fetch promotion forms" });
    }
  });

  app.get("/api/promotions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const form = await storage.getPromotionForm(id);
      if (!form) {
        return res.status(404).json({ error: "Promotion form not found" });
      }
      res.json(form);
    } catch (error) {
      console.error("❌ Failed to fetch promotion form:", error);
      res.status(500).json({ error: "Failed to fetch promotion form" });
    }
  });

  app.get("/api/promotions/crew/:crewMemberId", async (req, res) => {
    try {
      const crewMemberId = req.params.crewMemberId;
      const forms = await storage.getPromotionFormsByCrewMember(crewMemberId);
      res.json(forms);
    } catch (error) {
      console.error("❌ Failed to fetch promotion forms for crew member:", error);
      res.status(500).json({ error: "Failed to fetch promotion forms for crew member" });
    }
  });

  app.post("/api/promotions", async (req, res) => {
    try {
      const result = insertPromotionFormSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid promotion form data", details: result.error.issues });
      }
      const form = await storage.createPromotionForm(result.data);
      console.log(`✅ [API] Created promotion form ID ${form.id} for crew ${form.crewMemberId}`);
      res.status(201).json(form);
    } catch (error) {
      console.error("❌ Failed to create promotion form:", error);
      res.status(500).json({ error: "Failed to create promotion form" });
    }
  });

  app.patch("/api/promotions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertPromotionFormSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid promotion form data", details: result.error.issues });
      }
      const form = await storage.updatePromotionForm(id, result.data);
      if (!form) {
        return res.status(404).json({ error: "Promotion form not found" });
      }
      console.log(`✅ [API] Updated promotion form ID ${id}`);
      res.json(form);
    } catch (error) {
      console.error("❌ Failed to update promotion form:", error);
      res.status(500).json({ error: "Failed to update promotion form" });
    }
  });

  app.delete("/api/promotions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deletePromotionForm(id);
      if (!success) {
        return res.status(404).json({ error: "Promotion form not found" });
      }
      console.log(`✅ [API] Deleted promotion form ID ${id}`);
      res.json({ success: true, message: "Promotion form deleted successfully" });
    } catch (error) {
      console.error("❌ Failed to delete promotion form:", error);
      res.status(500).json({ error: "Failed to delete promotion form" });
    }
  });

  app.post("/api/promotions/:id/approve", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { reviewedBy, comments, effectiveDate } = req.body;
      
      if (!reviewedBy || !comments || !effectiveDate) {
        return res.status(400).json({ error: "Missing required fields: reviewedBy, comments, effectiveDate" });
      }

      const form = await storage.approvePromotionForm(id, reviewedBy, comments, effectiveDate);
      if (!form) {
        return res.status(404).json({ error: "Promotion form not found" });
      }
      console.log(`✅ [API] Approved promotion form ID ${id} by ${reviewedBy}`);
      res.json(form);
    } catch (error) {
      console.error("❌ Failed to approve promotion form:", error);
      res.status(500).json({ error: "Failed to approve promotion form" });
    }
  });

  app.post("/api/promotions/:id/reject", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { reviewedBy, comments } = req.body;
      
      if (!reviewedBy || !comments) {
        return res.status(400).json({ error: "Missing required fields: reviewedBy, comments" });
      }

      const form = await storage.rejectPromotionForm(id, reviewedBy, comments);
      if (!form) {
        return res.status(404).json({ error: "Promotion form not found" });
      }
      console.log(`✅ [API] Rejected promotion form ID ${id} by ${reviewedBy}`);
      res.json(form);
    } catch (error) {
      console.error("❌ Failed to reject promotion form:", error);
      res.status(500).json({ error: "Failed to reject promotion form" });
    }
  });

  // Vessel Groups API routes
  app.get("/api/vessel-groups", async (req, res) => {
    try {
      const vesselGroups = await storage.getVesselGroups();
      res.json(vesselGroups);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vessel groups" });
    }
  });

  app.get("/api/vessel-groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const vesselGroup = await storage.getVesselGroup(id);
      if (!vesselGroup) {
        return res.status(404).json({ error: "Vessel group not found" });
      }
      res.json(vesselGroup);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vessel group" });
    }
  });

  app.post("/api/vessel-groups", async (req, res) => {
    try {
      // Normalize vesselIds to JSON string before validation if it's an array
      const normalizedBody = {
        ...req.body,
        vesselIds: Array.isArray(req.body.vesselIds) 
          ? JSON.stringify(req.body.vesselIds) 
          : req.body.vesselIds
      };
      
      const result = insertVesselGroupSchema.safeParse(normalizedBody);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid vessel group data", details: result.error.issues });
      }
      
      const vesselGroup = await storage.createVesselGroup(result.data);
      res.status(201).json(vesselGroup);
    } catch (error) {
      res.status(500).json({ error: "Failed to create vessel group" });
    }
  });

  app.patch("/api/vessel-groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Normalize vesselIds to JSON string before validation if it's an array
      const normalizedBody = {
        ...req.body,
        ...(req.body.vesselIds && {
          vesselIds: Array.isArray(req.body.vesselIds) 
            ? JSON.stringify(req.body.vesselIds) 
            : req.body.vesselIds
        })
      };
      
      const result = insertVesselGroupSchema.partial().safeParse(normalizedBody);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid vessel group data", details: result.error.issues });
      }
      
      const vesselGroup = await storage.updateVesselGroup(id, result.data);
      if (!vesselGroup) {
        return res.status(404).json({ error: "Vessel group not found" });
      }
      res.json(vesselGroup);
    } catch (error) {
      res.status(500).json({ error: "Failed to update vessel group" });
    }
  });

  app.delete("/api/vessel-groups/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteVesselGroup(id);
      if (!success) {
        return res.status(404).json({ error: "Vessel group not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete vessel group" });
    }
  });

  // Vessel Drafts API routes
  app.get("/api/vessel-drafts", async (req, res) => {
    try {
      const vesselDrafts = await storage.getVesselDrafts();
      res.json(vesselDrafts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vessel drafts" });
    }
  });

  app.get("/api/vessel-drafts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const vesselDraft = await storage.getVesselDraft(id);
      if (!vesselDraft) {
        return res.status(404).json({ error: "Vessel draft not found" });
      }
      res.json(vesselDraft);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vessel draft" });
    }
  });

  app.get("/api/vessel-drafts/by-vessel/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      console.log(`🚢 [VESSEL DRAFT API] Fetching drafts for vessel: ${vesselId}`);
      const vesselDrafts = await storage.getVesselDraftsByVessel(vesselId);
      console.log(`🚢 [VESSEL DRAFT API] Found ${vesselDrafts.length} drafts for vessel ${vesselId}`);
      res.json(vesselDrafts);
    } catch (error) {
      console.error(`🚢 [VESSEL DRAFT API ERROR] Failed to fetch vessel drafts for vessel ${req.params.vesselId}:`, error);
      res.status(500).json({ error: "Failed to fetch vessel drafts for vessel" });
    }
  });

  app.post("/api/vessel-drafts", async (req, res) => {
    try {
      console.log(`🚢 [VESSEL DRAFT CREATE] Attempting to create vessel draft with data:`, req.body);
      const result = insertVesselDraftSchema.safeParse(req.body);
      if (!result.success) {
        console.error(`🚢 [VESSEL DRAFT VALIDATION ERROR] Schema validation failed:`, result.error.issues);
        return res.status(400).json({ error: "Invalid vessel draft data", details: result.error.issues });
      }
      
      console.log(`🚢 [VESSEL DRAFT CREATE] Validation passed, creating draft for vessel ${result.data.vesselId}`);
      const vesselDraft = await storage.createVesselDraft(result.data);
      console.log(`🚢 [VESSEL DRAFT CREATE] Successfully created draft with ID: ${vesselDraft.id}`);
      res.status(201).json(vesselDraft);
    } catch (error) {
      console.error(`🚢 [VESSEL DRAFT CREATE ERROR] Failed to create vessel draft:`, error);
      res.status(500).json({ error: "Failed to create vessel draft" });
    }
  });

  app.patch("/api/vessel-drafts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const result = insertVesselDraftSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid vessel draft data", details: result.error.issues });
      }
      
      const vesselDraft = await storage.updateVesselDraft(id, result.data);
      if (!vesselDraft) {
        return res.status(404).json({ error: "Vessel draft not found" });
      }
      res.json(vesselDraft);
    } catch (error) {
      res.status(500).json({ error: "Failed to update vessel draft" });
    }
  });

  app.delete("/api/vessel-drafts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteVesselDraft(id);
      if (!success) {
        return res.status(404).json({ error: "Vessel draft not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete vessel draft" });
    }
  });

  // Upsert vessel draft (update if exists, create if not) - convenience endpoint for Save Draft functionality
  app.post("/api/vessel-drafts/upsert", async (req, res) => {
    try {
      console.log(`💾 [DRAFT UPSERT] Attempting to save draft for vessel:`, req.body.vesselId);
      
      // Validate the request body
      const result = insertVesselDraftSchema.safeParse(req.body);
      if (!result.success) {
        console.error(`💾 [DRAFT UPSERT ERROR] Validation failed:`, result.error.issues);
        return res.status(400).json({ error: "Invalid vessel draft data", details: result.error.issues });
      }
      
      // Check if a draft already exists for this vessel
      const existingDrafts = await storage.getVesselDraftsByVessel(result.data.vesselId);
      
      if (existingDrafts.length > 0) {
        // Update the existing draft
        const existingDraft = existingDrafts[0]; // Use the first draft if multiple exist
        console.log(`💾 [DRAFT UPSERT] Found existing draft (ID: ${existingDraft.id}), updating...`);
        const updatedDraft = await storage.updateVesselDraft(existingDraft.id, result.data);
        console.log(`💾 [DRAFT UPSERT] Successfully updated draft ID: ${existingDraft.id}`);
        res.json({ action: "updated", draft: updatedDraft });
      } else {
        // Create a new draft
        console.log(`💾 [DRAFT UPSERT] No existing draft found, creating new draft...`);
        const newDraft = await storage.createVesselDraft(result.data);
        console.log(`💾 [DRAFT UPSERT] Successfully created new draft ID: ${newDraft.id}`);
        res.status(201).json({ action: "created", draft: newDraft });
      }
    } catch (error) {
      console.error(`💾 [DRAFT UPSERT ERROR] Failed to upsert vessel draft:`, error);
      res.status(500).json({ error: "Failed to save vessel draft" });
    }
  });

  // Vessel Revisions API routes
  app.get("/api/vessel-revisions", async (req, res) => {
    try {
      const vesselRevisions = await storage.getVesselRevisions();
      res.json(vesselRevisions);
    } catch (error) {
      console.error("Failed to fetch vessel revisions:", error);
      res.status(500).json({ error: "Failed to fetch vessel revisions" });
    }
  });

  // IMPORTANT: Literal path segments must come BEFORE parameterized routes to avoid shadowing
  app.get("/api/vessel-revisions/by-vessel/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      console.log(`📜 [VESSEL REVISION API] Fetching revisions for vessel: ${vesselId}`);
      const vesselRevisions = await storage.getVesselRevisionsByVessel(vesselId);
      console.log(`📜 [VESSEL REVISION API] Found ${vesselRevisions.length} revisions for vessel ${vesselId}`);
      res.json(vesselRevisions);
    } catch (error) {
      console.error("Failed to fetch vessel revisions by vessel:", error);
      res.status(500).json({ error: "Failed to fetch vessel revisions" });
    }
  });

  // Debug endpoint to inspect all revisions for a vessel
  app.get("/api/vessel-revisions/debug/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      console.log(`🔍 [DEBUG API] Fetching revision metadata for vessel: ${vesselId}`);
      
      const vesselRevisions = await storage.getVesselRevisionsByVessel(vesselId);
      
      if (vesselRevisions.length === 0) {
        return res.json({ vesselId, message: "No revisions found", revisions: [] });
      }
      
      // Build debug info for each revision
      const debugInfo = vesselRevisions.map((rev) => {
        let rankCount = 0;
        let activeRankCount = 0;
        
        try {
          const rankData = JSON.parse(rev.revisionData);
          rankCount = rankData.length;
          activeRankCount = rankData.filter((rank: any) => 
            rank.actualManningFlag || rank.safeManning || rank.optimumManning || rank.highWorkloadManning
          ).length;
        } catch (e) {
          // Invalid JSON
        }
        
        return {
          id: rev.id,
          revision: rev.revision,
          revisionDate: rev.revisionDate,
          createdAt: rev.createdAt,
          totalRanks: rankCount,
          activeRanks: activeRankCount,
          hasData: rankCount > 0
        };
      });
      
      // Sort by creation date to show which would be selected
      const sorted = [...debugInfo].sort((a, b) => {
        const aDate = new Date(a.createdAt || 0).getTime();
        const bDate = new Date(b.createdAt || 0).getTime();
        return bDate - aDate;
      });
      
      res.json({
        vesselId,
        totalRevisions: vesselRevisions.length,
        selectedRevision: sorted[0],
        allRevisions: sorted
      });
    } catch (error) {
      console.error("Failed to debug vessel revisions:", error);
      res.status(500).json({ error: "Failed to debug vessel revisions" });
    }
  });

  // Get vessel ranks from latest revision (must come before :id route)
  app.get("/api/vessel-revisions/ranks/:vesselId", async (req, res) => {
    try {
      let { vesselId } = req.params;
      console.log(`📜 [VESSEL RANKS API] Fetching ranks for vessel: ${vesselId}`);
      
      // BACKWARD COMPATIBILITY: If vesselId doesn't start with VSL-, try to translate to canonical ID
      if (!vesselId.startsWith('VSL-')) {
        console.log(`📜 [VESSEL RANKS API] vesselId doesn't start with VSL-, attempting translation`);
        const vessels = await storage.getMasterDataEntries("014"); // Get all vessels
        
        // Try matching by name first, then by numeric ID
        let matchedVessel = vessels.find((v: any) => 
          v.name === vesselId || v.vessel === vesselId
        );
        
        // If not found by name and vesselId is numeric, try matching by master data entry ID
        if (!matchedVessel && /^\d+$/.test(vesselId)) {
          matchedVessel = vessels.find((v: any) => String(v.id) === vesselId);
          if (matchedVessel) {
            console.log(`📜 [VESSEL RANKS API] Matched numeric ID "${vesselId}" to vessel entry`);
          }
        }
        
        if (matchedVessel) {
          const translatedId = matchedVessel.entryId;
          console.log(`📜 [VESSEL RANKS API] Translated "${vesselId}" to canonical ID "${translatedId}"`);
          vesselId = translatedId;
        } else {
          console.log(`📜 [VESSEL RANKS API] No vessel found matching "${vesselId}"`);
        }
      }
      
      // Get all revisions for this vessel
      const vesselRevisions = await storage.getVesselRevisionsByVessel(vesselId);
      
      if (vesselRevisions.length === 0) {
        console.log(`📜 [VESSEL RANKS API] No revisions found for vessel ${vesselId}`);
        return res.json([]);
      }
      
      // Sort revisions by creation date (most recent first) to get the truly latest configuration
      // This handles cases where multiple revisions with the same number exist
      const sortedRevisions = vesselRevisions.sort((a, b) => {
        const aDate = new Date(a.createdAt || 0).getTime();
        const bDate = new Date(b.createdAt || 0).getTime();
        return bDate - aDate; // Most recent first
      });
      
      const latestRevision = sortedRevisions[0];
      console.log(`📜 [VESSEL RANKS API] Latest revision for vessel ${vesselId}: ${latestRevision.revision} (id: ${latestRevision.id}, created: ${latestRevision.createdAt})`);
      
      // Parse the revisionData JSON to get the ranks
      const rankData = JSON.parse(latestRevision.revisionData);
      
      // Merge with current available ranks to get sortOrder (only exists in available_ranks table)
      // Also merge with company ranks to get designation fields
      const availableRanks = await storage.getAvailableRanks();
      const availableRanksMap = new Map(availableRanks.map((ar: any) => [String(ar.id), ar]));
      
      const companyRanks = await storage.getCompanyRanks();
      const companyRanksMap = new Map(companyRanks.map((cr: any) => [cr.id, cr]));
      
      const mergedRankData = rankData.map((vesselRank: any) => {
        const companyRank: any = companyRanksMap.get(vesselRank.id);
        const availableRank: any = availableRanksMap.get(vesselRank.id);
        
        if (companyRank || availableRank) {
          return {
            ...vesselRank,
            // Get sortOrder from available_ranks table (only place it exists)
            sortOrder: availableRank?.sortOrder ?? vesselRank.sortOrder ?? 0,
            // Update company-only designation fields from current company ranks
            officer: companyRank?.officer ?? vesselRank.officer ?? false,
            rating: companyRank?.rating ?? vesselRank.rating ?? false,
            seniorOfficer: companyRank?.seniorOfficer ?? vesselRank.seniorOfficer ?? false,
            deckOfficer: companyRank?.deckOfficer ?? vesselRank.deckOfficer ?? false,
            engOfficer: companyRank?.engOfficer ?? vesselRank.engOfficer ?? false,
            pettyOfficer: companyRank?.pettyOfficer ?? vesselRank.pettyOfficer ?? false,
            deckRating: companyRank?.deckRating ?? vesselRank.deckRating ?? false,
            engineRating: companyRank?.engineRating ?? vesselRank.engineRating ?? false,
            generalRating: companyRank?.generalRating ?? vesselRank.generalRating ?? false,
            cateringRating: companyRank?.cateringRating ?? vesselRank.cateringRating ?? false,
            // Preserve vessel-specific overrides if they exist
            safetyOfficer: vesselRank.safetyOfficer ?? companyRank?.safetyOfficer ?? false,
            sso: vesselRank.sso ?? companyRank?.sso ?? false,
            medicalOfficer: vesselRank.medicalOfficer ?? companyRank?.medicalOfficer ?? false,
            navigatingOfficer: vesselRank.navigatingOfficer ?? companyRank?.navigatingOfficer ?? false,
            emtOfficer: vesselRank.emtOfficer ?? companyRank?.emtOfficer ?? false,
          };
        }
        return vesselRank;
      });
      
      // Filter ranks that have "Actual Manning" checked
      // The crew list should only display ranks with actualManningFlag = true
      const activeRanks = mergedRankData.filter((rank: any) => 
        rank.actualManningFlag
      );
      
      console.log(`📜 [VESSEL RANKS API] Found ${activeRanks.length} active ranks for vessel ${vesselId} (merged with company ranks)`);
      console.log(`📜 [VESSEL RANKS API] Before sort - first 3 ranks:`, activeRanks.slice(0, 3).map((r: any) => `${r.id}:${r.rank}(sortOrder:${r.sortOrder})`));
      
      // Sort manually by sortOrder to ensure correct display order
      const sortedRanks = activeRanks.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
      
      console.log(`📜 [VESSEL RANKS API] After sort - first 3 ranks:`, sortedRanks.slice(0, 3).map((r: any) => `${r.id}:${r.rank}(sortOrder:${r.sortOrder})`));
      res.json(sortedRanks);
    } catch (error) {
      console.error("Failed to fetch vessel ranks:", error);
      res.status(500).json({ error: "Failed to fetch vessel ranks" });
    }
  });

  // Get next revision number for a vessel (must come before :id route)
  app.get("/api/vessel-revisions/next-revision/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      console.log(`📜 [NEXT REVISION] Getting next revision number for vessel: ${vesselId}`);
      
      // Get all existing revisions for this vessel
      const existingRevisions = await storage.getVesselRevisionsByVessel(vesselId);
      
      // Extract revision numbers and find the highest one
      // Expected format: "R0", "R1", "R2", etc.
      let maxRevisionNumber = -1;
      for (const revision of existingRevisions) {
        const match = revision.revision.match(/^R(\d+)$/);
        if (match) {
          const revisionNumber = parseInt(match[1], 10);
          if (revisionNumber > maxRevisionNumber) {
            maxRevisionNumber = revisionNumber;
          }
        }
      }
      
      // Next revision is maxRevisionNumber + 1, formatted as "R{n}"
      const nextRevisionNumber = maxRevisionNumber + 1;
      const nextRevision = `R${nextRevisionNumber}`;
      
      console.log(`📜 [NEXT REVISION] Vessel ${vesselId} has ${existingRevisions.length} existing revisions, next: ${nextRevision}`);
      res.json({ vesselId, nextRevision, revisionNumber: nextRevisionNumber });
    } catch (error) {
      console.error("Failed to get next revision number:", error);
      res.status(500).json({ error: "Failed to get next revision number" });
    }
  });

  app.get("/api/vessel-revisions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Validate that id is a valid number
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid revision ID - must be a number" });
      }
      const vesselRevision = await storage.getVesselRevision(id);
      if (!vesselRevision) {
        return res.status(404).json({ error: "Vessel revision not found" });
      }
      res.json(vesselRevision);
    } catch (error) {
      console.error("Failed to fetch vessel revision:", error);
      res.status(500).json({ error: "Failed to fetch vessel revision" });
    }
  });

  app.post("/api/vessel-revisions", async (req, res) => {
    try {
      console.log(`📜 [VESSEL REVISION CREATE] Attempting to create vessel revision with data:`, req.body);
      const result = insertVesselRevisionSchema.safeParse(req.body);
      if (!result.success) {
        console.error(`📜 [VESSEL REVISION VALIDATION ERROR] Schema validation failed:`, result.error.issues);
        return res.status(400).json({ error: "Invalid vessel revision data", details: result.error.issues });
      }
      
      const vesselRevision = await storage.createVesselRevision(result.data);
      console.log(`📜 [VESSEL REVISION CREATED] Successfully created revision with ID: ${vesselRevision.id}`);
      res.status(201).json(vesselRevision);
    } catch (error) {
      console.error(`📜 [VESSEL REVISION CREATE ERROR] Failed to create vessel revision:`, error);
      res.status(500).json({ error: "Failed to create vessel revision" });
    }
  });

  // Submit vessel revision - comprehensive endpoint that handles the entire Submit workflow
  app.post("/api/vessel-revisions/submit", async (req, res) => {
    try {
      console.log(`✅ [SUBMIT] Starting Submit workflow for vessel:`, req.body.vesselId);
      
      // Step 1: Validate the request body (excluding revision since it will be auto-assigned)
      // Submit schema omits "revision" field because it's computed server-side
      const submitSchema = insertVesselRevisionSchema.omit({ revision: true });
      const validationResult = submitSchema.safeParse(req.body);
      if (!validationResult.success) {
        console.error(`✅ [SUBMIT ERROR] Validation failed:`, validationResult.error.issues);
        return res.status(400).json({ 
          error: "Invalid vessel revision data", 
          details: validationResult.error.issues 
        });
      }
      
      const { vesselId, revisionData, revisionDate } = validationResult.data;
      console.log(`✅ [SUBMIT] Validation passed for vessel ${vesselId}, date: ${revisionDate}`);
      
      // Step 2: Get the next revision number for this vessel
      const existingRevisions = await storage.getVesselRevisionsByVessel(vesselId);
      let maxRevisionNumber = -1;
      for (const revision of existingRevisions) {
        const match = revision.revision.match(/^R(\d+)$/);
        if (match) {
          const revisionNumber = parseInt(match[1], 10);
          if (revisionNumber > maxRevisionNumber) {
            maxRevisionNumber = revisionNumber;
          }
        }
      }
      const nextRevisionNumber = maxRevisionNumber + 1;
      const nextRevision = `R${nextRevisionNumber}`;
      console.log(`✅ [SUBMIT] Auto-assigned revision: ${nextRevision} (vessel has ${existingRevisions.length} existing revisions)`);
      
      // Step 3: Create the finalized vessel revision with the auto-assigned revision number
      const revisionToCreate = {
        vesselId,
        revision: nextRevision,
        revisionDate,
        revisionData
      };
      const createdRevision = await storage.createVesselRevision(revisionToCreate);
      console.log(`✅ [SUBMIT] Created revision with ID: ${createdRevision.id}, revision: ${nextRevision}`);
      
      // Step 4: Delete any existing drafts for this vessel (best-effort cleanup)
      const existingDrafts = await storage.getVesselDraftsByVessel(vesselId);
      let deletedDraftsCount = 0;
      const failedDraftIds: number[] = [];
      for (const draft of existingDrafts) {
        try {
          const deleted = await storage.deleteVesselDraft(draft.id);
          if (deleted) {
            deletedDraftsCount++;
          } else {
            failedDraftIds.push(draft.id);
          }
        } catch (deleteError) {
          console.warn(`✅ [SUBMIT WARNING] Failed to delete draft ${draft.id}:`, deleteError);
          failedDraftIds.push(draft.id);
        }
      }
      console.log(`✅ [SUBMIT] Cleaned up ${deletedDraftsCount} draft(s) for vessel ${vesselId}${failedDraftIds.length > 0 ? `, failed to delete ${failedDraftIds.length} draft(s)` : ''}`);
      
      // Step 5: Auto-initialize vessel_planning records for new ranks
      console.log(`🔗 [VESSEL PLANNING] Syncing vessel_planning records with vessel ranks`);
      try {
        // Parse revisionData - it's directly an array of rank objects
        const parsedRevisionData = typeof revisionData === 'string' ? JSON.parse(revisionData) : revisionData;
        const ranks = Array.isArray(parsedRevisionData) ? parsedRevisionData : [];
        
        console.log(`🔗 [VESSEL PLANNING] Found ${ranks.length} rank(s) in submitted revision for vessel ${vesselId}`);
        
        // Get existing vessel planning records for this vessel
        const existingPlanning = await storage.getVesselPlanningByVessel(vesselId);
        const existingRankIds = new Set(existingPlanning.map((p: any) => p.rankId));
        
        console.log(`🔗 [VESSEL PLANNING] Found ${existingPlanning.length} existing planning record(s), ${existingRankIds.size} unique rank IDs`);
        
        let createdPlanningCount = 0;
        for (const rank of ranks) {
          const rankId = rank.rankId || rank.id;
          const rankName = rank.rank || rank.role;
          
          // Skip if no rankId or if it's a role row (these are variants, not primary positions)
          if (!rankId || rank.isRoleRow) {
            continue;
          }
          
          // Only create planning record if it doesn't already exist for this rank
          if (!existingRankIds.has(rankId)) {
            try {
              await storage.createVesselPlanning({
                vesselId: vesselId,
                rankId: rankId,
                rank: rankName,
                onBoardCrewId: null,
                onBoardCrewName: null,
                reliefDue: null,
                signOffDate: null,
                signOffPort: null,
                reliefStatus: null,
                relieverCrewId: null,
                relieverCrewName: null,
                joiningDate: null,
                joiningPort: null,
                joiningStatus: null
              });
              createdPlanningCount++;
              console.log(`🔗 [VESSEL PLANNING] Created planning record for rank: ${rankName} (ID: ${rankId})`);
            } catch (planningError) {
              console.warn(`🔗 [VESSEL PLANNING WARNING] Failed to create planning for rank ${rankId}:`, planningError);
            }
          } else {
            console.log(`🔗 [VESSEL PLANNING] Skipping existing rank: ${rankName} (ID: ${rankId})`);
          }
        }
        console.log(`🔗 [VESSEL PLANNING] ✅ Created ${createdPlanningCount} new planning record(s) for vessel ${vesselId}`);
      } catch (planningError) {
        console.error(`🔗 [VESSEL PLANNING ERROR] Failed to sync vessel_planning:`, planningError);
        // Don't fail the entire submission if planning sync fails
      }
      
      // Step 6: Return the created revision with metadata
      res.status(201).json({
        success: true,
        revision: createdRevision,
        metadata: {
          autoAssignedRevision: nextRevision,
          deletedDrafts: deletedDraftsCount,
          failedDraftIds: failedDraftIds.length > 0 ? failedDraftIds : undefined
        }
      });
      console.log(`✅ [SUBMIT] Submit workflow completed successfully for vessel ${vesselId}`);
    } catch (error) {
      console.error(`✅ [SUBMIT ERROR] Submit workflow failed:`, error);
      res.status(500).json({ error: "Failed to submit vessel revision" });
    }
  });

  // Vessel Planning API routes
  app.get("/api/vessel-planning", async (req, res) => {
    try {
      const { vesselId, crewMemberId, status } = req.query;
      
      // Get base dataset - use vessel-filtered or all records
      let planning = vesselId 
        ? await storage.getVesselPlanningByVessel(vesselId as string)
        : await storage.getAllVesselPlanning();
      
      // JOIN with crew members to enrich data
      const crewMembers = await storage.getCrewMembers();
      const crewMap = new Map(crewMembers.map((c: any) => [c.id || c.employeeId, c]));
      
      // Enrich planning data with crew member information
      planning = planning.map((p: any) => {
        const enriched = { ...p };
        
        // Enrich on-board crew data
        if (p.crewMemberId) {
          const crew: any = crewMap.get(p.crewMemberId);
          if (crew) {
            enriched.crewName = `${crew.firstName || ''} ${crew.lastName || ''}`.trim();
            enriched.nationality = crew.nationality;
          }
        }
        
        // Enrich reliever crew data
        if (p.relieverCrewId) {
          const reliever: any = crewMap.get(p.relieverCrewId);
          if (reliever) {
            // Format as "Surname, Given Name" to match column header
            const lastName = reliever.familyName || reliever.lastName || '';
            const firstName = reliever.firstName || '';
            enriched.relieverCrewName = lastName && firstName ? `${lastName}, ${firstName}` : (lastName || firstName);
            enriched.relieverNationality = reliever.nationality;
          }
        }
        
        return enriched;
      });
      
      // Apply additional optional filters to the enriched dataset
      if (crewMemberId) {
        planning = planning.filter((p: VesselPlanning) => p.crewMemberId === crewMemberId);
      }
      if (status) {
        planning = planning.filter((p: VesselPlanning) => p.reliefStatus === status);
      }
      
      res.json(planning || []);
    } catch (error) {
      console.error("Get vessel planning error:", error);
      res.status(500).json({ error: "Failed to get vessel planning records" });
    }
  });

  app.get("/api/vessel-planning/vessel/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const planning = await storage.getVesselPlanningByVessel(vesselId);
      
      // JOIN with crew members to get complete data from single source of truth
      const crewMembers = await storage.getCrewMembers();
      const crewMap = new Map(crewMembers.map((c: any) => [c.id || c.employeeId, c]));
      
      // Enrich planning data with crew member information
      const enrichedPlanning = planning.map((p: any) => {
        const enriched = { ...p };
        
        // Enrich on-board crew data
        if (p.crewMemberId) {
          const crew: any = crewMap.get(p.crewMemberId);
          if (crew) {
            enriched.crewName = `${crew.firstName || ''} ${crew.lastName || ''}`.trim();
            enriched.nationality = crew.nationality;
            enriched.reliefDue = crew.reliefDue;
            enriched.reliefDate = crew.reliefDue; // Alias for backward compatibility
            enriched.crewMemberData = {
              id: crew.id,
              employeeId: crew.employeeId,
              firstName: crew.firstName,
              lastName: crew.lastName,
              nationality: crew.nationality,
              presentRank: crew.presentRank
            };
          }
        }
        
        // Enrich reliever crew data
        if (p.relieverCrewId) {
          const reliever: any = crewMap.get(p.relieverCrewId);
          if (reliever) {
            // Only enrich relieverCrewName if not already populated in database
            if (!p.relieverCrewName) {
              const lastName = reliever.familyName || reliever.lastName || '';
              const firstName = reliever.firstName || '';
              enriched.relieverCrewName = lastName && firstName ? `${lastName}, ${firstName}` : (lastName || firstName);
            }
            // Only enrich relieverNationality if not already populated
            if (!p.relieverNationality) {
              enriched.relieverNationality = reliever.nationality;
            }
            enriched.relieverData = {
              id: reliever.id,
              employeeId: reliever.employeeId,
              firstName: reliever.firstName,
              lastName: reliever.lastName,
              nationality: reliever.nationality,
              presentRank: reliever.presentRank
            };
          }
        }
        
        return enriched;
      });
      
      res.json(enrichedPlanning);
    } catch (error) {
      console.error("Failed to fetch vessel planning:", error);
      res.status(500).json({ error: "Failed to fetch vessel planning" });
    }
  });

  app.get("/api/vessel-planning/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid planning ID - must be a number" });
      }
      const planning = await storage.getVesselPlanningById(id);
      if (!planning) {
        return res.status(404).json({ error: "Vessel planning not found" });
      }
      res.json(planning);
    } catch (error) {
      console.error("Failed to fetch vessel planning:", error);
      res.status(500).json({ error: "Failed to fetch vessel planning" });
    }
  });

  app.post("/api/vessel-planning", async (req, res) => {
    try {
      const result = insertVesselPlanningSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid vessel planning data", details: result.error.issues });
      }
      const planning = await storage.createVesselPlanning(result.data);
      res.status(201).json(planning);
    } catch (error) {
      console.error("Failed to create vessel planning:", error);
      res.status(500).json({ error: "Failed to create vessel planning" });
    }
  });

  app.put("/api/vessel-planning/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid planning ID - must be a number" });
      }
      const planning = await storage.updateVesselPlanning(id, req.body);
      if (!planning) {
        return res.status(404).json({ error: "Vessel planning not found" });
      }
      res.json(planning);
    } catch (error) {
      console.error("Failed to update vessel planning:", error);
      res.status(500).json({ error: "Failed to update vessel planning" });
    }
  });

  app.patch("/api/vessel-planning/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid planning ID - must be a number" });
      }
      const planning = await storage.updateVesselPlanning(id, req.body);
      if (!planning) {
        return res.status(404).json({ error: "Vessel planning not found" });
      }
      res.json(planning);
    } catch (error) {
      console.error("Failed to update vessel planning:", error);
      res.status(500).json({ error: "Failed to update vessel planning" });
    }
  });

  app.delete("/api/vessel-planning/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid planning ID - must be a number" });
      }
      const deleted = await storage.deleteVesselPlanning(id);
      if (!deleted) {
        return res.status(404).json({ error: "Vessel planning not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete vessel planning:", error);
      res.status(500).json({ error: "Failed to delete vessel planning" });
    }
  });

  // Rotation Plans API routes
  app.get("/api/rotation-plans", async (req, res) => {
    try {
      const plans = await storage.getRotationPlans();
      res.json(plans);
    } catch (error) {
      console.error("Failed to fetch rotation plans:", error);
      res.status(500).json({ error: "Failed to fetch rotation plans" });
    }
  });

  app.get("/api/rotation-plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid plan ID - must be a number" });
      }
      const plan = await storage.getRotationPlan(id);
      if (!plan) {
        return res.status(404).json({ error: "Rotation plan not found" });
      }
      res.json(plan);
    } catch (error) {
      console.error("Failed to fetch rotation plan:", error);
      res.status(500).json({ error: "Failed to fetch rotation plan" });
    }
  });

  app.post("/api/rotation-plans", async (req, res) => {
    try {
      const result = insertRotationPlanSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid rotation plan data", details: result.error.issues });
      }
      const plan = await storage.createRotationPlan(result.data);
      res.status(201).json(plan);
    } catch (error) {
      console.error("Failed to create rotation plan:", error);
      res.status(500).json({ error: "Failed to create rotation plan" });
    }
  });

  app.patch("/api/rotation-plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid plan ID - must be a number" });
      }
      const result = insertRotationPlanSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid rotation plan data", details: result.error.issues });
      }
      
      // Update lastEdited timestamp
      const updateData = {
        ...result.data,
        lastEdited: new Date().toISOString(),
      };
      
      const plan = await storage.updateRotationPlan(id, updateData);
      if (!plan) {
        return res.status(404).json({ error: "Rotation plan not found" });
      }
      res.json(plan);
    } catch (error) {
      console.error("Failed to update rotation plan:", error);
      res.status(500).json({ error: "Failed to update rotation plan" });
    }
  });

  app.delete("/api/rotation-plans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid plan ID - must be a number" });
      }
      const deleted = await storage.deleteRotationPlan(id);
      if (!deleted) {
        return res.status(404).json({ error: "Rotation plan not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete rotation plan:", error);
      res.status(500).json({ error: "Failed to delete rotation plan" });
    }
  });

  // Rotation Approval Workflow API routes
  app.post("/api/rotation-plans/:id/propose", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid plan ID - must be a number" });
      }
      const { proposedBy } = req.body;
      if (!proposedBy) {
        return res.status(400).json({ error: "proposedBy is required" });
      }
      const plan = await storage.proposeRotationPlan(id, proposedBy);
      if (!plan) {
        return res.status(404).json({ error: "Rotation plan not found" });
      }
      res.json(plan);
    } catch (error) {
      console.error("Failed to propose rotation plan:", error);
      res.status(500).json({ error: "Failed to propose rotation plan" });
    }
  });

  app.get("/api/rotation/proposals", async (req, res) => {
    try {
      const filters = {
        vessels: req.query.vessels ? JSON.parse(req.query.vessels as string) : undefined,
        ranks: req.query.ranks ? JSON.parse(req.query.ranks as string) : undefined,
        draftId: req.query.draftId as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
      };
      const proposals = await storage.getProposedAssignments(filters);
      res.json(proposals);
    } catch (error) {
      console.error("Failed to fetch proposals:", error);
      res.status(500).json({ error: "Failed to fetch proposals" });
    }
  });

  app.post("/api/rotation/proposals/deploy", async (req, res) => {
    try {
      const { planId, assignmentIndex, deployedBy } = req.body;
      if (typeof planId !== 'number' || typeof assignmentIndex !== 'number' || !deployedBy) {
        return res.status(400).json({ error: "planId, assignmentIndex, and deployedBy are required" });
      }
      const result = await storage.deployAssignment(planId, assignmentIndex, deployedBy);
      
      // Return 409 Conflict status for conflicts - this ensures frontend sees it as an error
      if (!result.success && result.conflicts && result.conflicts.length > 0) {
        return res.status(409).json({ error: "Assignment conflicts detected", conflicts: result.conflicts });
      }
      
      // Return 400 Bad Request for other failures
      if (!result.success) {
        return res.status(400).json({ error: "Failed to deploy assignment" });
      }
      
      res.json({ 
        success: true, 
        vesselPlanningId: result.vesselPlanningId,
        vesselCode: result.vesselCode,  // Return vessel code for cache invalidation
        message: 'Assignment deployed successfully' 
      });
    } catch (error) {
      console.error("Failed to deploy assignment:", error);
      res.status(500).json({ error: "Failed to deploy assignment" });
    }
  });

  app.post("/api/rotation/proposals/reject", async (req, res) => {
    try {
      const { planId, assignmentIndex } = req.body;
      if (typeof planId !== 'number' || typeof assignmentIndex !== 'number') {
        return res.status(400).json({ error: "planId and assignmentIndex are required" });
      }
      const plan = await storage.rejectAssignment(planId, assignmentIndex);
      if (!plan) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.json(plan);
    } catch (error) {
      console.error("Failed to reject assignment:", error);
      res.status(500).json({ error: "Failed to reject assignment" });
    }
  });

  app.get("/api/rotation/proposals/conflicts", async (req, res) => {
    try {
      const { 
        crewMemberId, crewId, 
        startDate, joiningDate,
        endDate, reliefDue,
        contractPeriod, vesselId
      } = req.query;
      
      // Accept both parameter formats (crewMemberId OR crewId)
      const crew = (crewMemberId || crewId) as string;
      
      // Accept both date formats (startDate OR joiningDate)
      const start = (startDate || joiningDate) as string;
      
      // Calculate end date from endDate OR reliefDue OR contractPeriod
      let end: string;
      if (endDate || reliefDue) {
        end = (endDate || reliefDue) as string;
      } else if (start && contractPeriod) {
        // Calculate end date from start + contractPeriod (months)
        const startObj = new Date(start);
        startObj.setMonth(startObj.getMonth() + parseInt(contractPeriod as string));
        end = startObj.toISOString().split('T')[0];
      } else {
        return res.status(400).json({ 
          error: "Required parameters: (crewMemberId OR crewId), (startDate OR joiningDate), and (endDate OR reliefDue OR contractPeriod)" 
        });
      }
      
      if (!crew || !start) {
        return res.status(400).json({ 
          error: "Required parameters: (crewMemberId OR crewId), (startDate OR joiningDate), and (endDate OR reliefDue OR contractPeriod)" 
        });
      }
      
      // Calculate contract period in months for conflict check
      const startObj = new Date(start);
      const endObj = new Date(end);
      const months = Math.max(1,
        (endObj.getFullYear() - startObj.getFullYear()) * 12 + 
        (endObj.getMonth() - startObj.getMonth())
      );
      
      const conflicts = await storage.checkAssignmentConflicts(
        crew,
        start,
        months
      );
      res.json(conflicts);
    } catch (error) {
      console.error("Failed to check conflicts:", error);
      res.status(500).json({ error: "Failed to check conflicts" });
    }
  });

  // Drug/Alcohol Test Records API routes
  app.get("/api/drug-alcohol-tests", async (req, res) => {
    try {
      const records = await storage.getDrugAlcoholTestRecords();
      res.json(records);
    } catch (error) {
      console.error("Failed to fetch drug/alcohol test records:", error);
      res.status(500).json({ error: "Failed to fetch drug/alcohol test records" });
    }
  });

  app.get("/api/drug-alcohol-tests/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const record = await storage.getDrugAlcoholTestRecord(id);
      if (!record) {
        return res.status(404).json({ error: "Drug/alcohol test record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Failed to fetch drug/alcohol test record:", error);
      res.status(500).json({ error: "Failed to fetch drug/alcohol test record" });
    }
  });

  app.get("/api/drug-alcohol-tests/vessel/:vesselId", async (req, res) => {
    try {
      const { vesselId } = req.params;
      const { testType } = req.query;
      const records = await storage.getDrugAlcoholTestRecordsByVessel(
        vesselId,
        testType as string | undefined
      );
      res.json(records);
    } catch (error) {
      console.error("Failed to fetch drug/alcohol test records by vessel:", error);
      res.status(500).json({ error: "Failed to fetch drug/alcohol test records by vessel" });
    }
  });

  app.post("/api/drug-alcohol-tests", async (req, res) => {
    try {
      const result = insertDrugAlcoholTestRecordSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid drug/alcohol test record data", details: result.error.issues });
      }
      const record = await storage.createDrugAlcoholTestRecord(result.data);
      res.status(201).json(record);
    } catch (error) {
      console.error("Failed to create drug/alcohol test record:", error);
      res.status(500).json({ error: "Failed to create drug/alcohol test record" });
    }
  });

  app.put("/api/drug-alcohol-tests/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const result = insertDrugAlcoholTestRecordSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid drug/alcohol test record data", details: result.error.issues });
      }
      const record = await storage.updateDrugAlcoholTestRecord(id, result.data);
      if (!record) {
        return res.status(404).json({ error: "Drug/alcohol test record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Failed to update drug/alcohol test record:", error);
      res.status(500).json({ error: "Failed to update drug/alcohol test record" });
    }
  });

  app.delete("/api/drug-alcohol-tests/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const deleted = await storage.deleteDrugAlcoholTestRecord(id);
      if (!deleted) {
        return res.status(404).json({ error: "Drug/alcohol test record not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete drug/alcohol test record:", error);
      res.status(500).json({ error: "Failed to delete drug/alcohol test record" });
    }
  });

  // Rest Hours Vessel Records API routes
  app.get("/api/rest-hours-vessel-records", async (req, res) => {
    try {
      const { vesselIds, monthValue, complianceMode, opaMode } = req.query;
      
      // Parse compliance mode and OPA mode (default to Rest and false)
      const mode: 'Rest' | 'Work' = (complianceMode as string) === 'Work' ? 'Work' : 'Rest';
      const isOpaMode = opaMode === 'true';
      
      // Get all crew members to calculate actual crew counts
      const allCrewMembers = await storage.getCrewMembers();
      
      // Get vessel master data for name/ID mapping
      const vesselMasterData = await storage.getMasterDataEntries('014');
      
      // Build comprehensive vessel name ↔ ID maps from master data
      const vesselNameToIdMap = new Map<string, string>();
      const vesselIdToNameMap = new Map<string, string>();
      vesselMasterData.forEach((entry: any) => {
        const entryId = entry.entryId || entry.entry_id;
        if (!entryId) return;
        
        // Map all possible name fields to the canonical ID
        if (entry.name) vesselNameToIdMap.set(entry.name, entryId);
        if (entry.label) vesselNameToIdMap.set(entry.label, entryId);
        if (entry.vessel) vesselNameToIdMap.set(entry.vessel, entryId);
        
        // Map the ID to itself for direct ID lookups
        vesselNameToIdMap.set(entryId, entryId);
        
        // Store ID → name mapping
        const displayName = entry.name || entry.label || entry.vessel || entryId;
        vesselIdToNameMap.set(entryId, displayName);
      });
      
      // Count crew per vessel using dynamic mapping
      const crewCountByVessel = new Map<string, number>();
      allCrewMembers.forEach((crew: any) => {
        const vesselName = crew.presentVessel || crew.vessel;
        if (vesselName) {
          const vesselId = vesselNameToIdMap.get(vesselName);
          if (vesselId) {
            crewCountByVessel.set(vesselId, (crewCountByVessel.get(vesselId) || 0) + 1);
          }
        }
      });
      
      // Build filters for persisted records
      const filters: { vesselIds?: string[]; monthValue?: string } = {};
      if (vesselIds) {
        filters.vesselIds = typeof vesselIds === 'string' ? [vesselIds] : vesselIds as string[];
      }
      if (monthValue) {
        filters.monthValue = monthValue as string;
      }
      
      // Get persisted vessel records from storage with filters
      const persistedRecords = Object.keys(filters).length > 0
        ? await storage.getRestHoursVesselRecordsByFilters(filters)
        : await storage.getRestHoursVesselRecords();
      
      // Generate month display from monthValue
      const formatMonth = (monthVal: string): string => {
        if (!monthVal) return '';
        const [year, month] = monthVal.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndex = parseInt(month) - 1;
        return `${monthNames[monthIndex]}-${year}`;
      };
      
      // Determine which month to show
      const targetMonth = monthValue as string || '';
      
      // Get all daily records for calculating percentages
      const allDailyRecords = await storage.getRestHoursDailyRecords();
      
      // Group daily records by vessel and month for percentage calculation
      const dailyRecordsByVesselMonth = new Map<string, any[]>();
      allDailyRecords.forEach(record => {
        const key = `${record.vesselId}-${record.monthYear}`;
        if (!dailyRecordsByVesselMonth.has(key)) {
          dailyRecordsByVesselMonth.set(key, []);
        }
        dailyRecordsByVesselMonth.get(key)!.push(record);
      });
      
      let allVesselRecords;
      
      if (targetMonth) {
        // Month filter is specified - show all vessels for this month with left-join
        const persistedRecordsMap = new Map<string, any>();
        persistedRecords.forEach(record => {
          const key = `${record.vesselId}-${record.monthValue}`;
          persistedRecordsMap.set(key, record);
        });
        
        // Determine which vessels to generate records for
        const targetVessels = filters.vesselIds && filters.vesselIds.length > 0
          ? Array.from(vesselIdToNameMap.entries()).filter(([vesselId]) => filters.vesselIds!.includes(vesselId))
          : Array.from(vesselIdToNameMap.entries());
        
        allVesselRecords = targetVessels.map(([vesselId, vesselName]) => {
          const key = `${vesselId}-${targetMonth}`;
          const persistedRecord = persistedRecordsMap.get(key);
          
          // Calculate actual recording percentage and violations from crew daily records
          let recordingPercent = 0;
          let totalViolations = 0;
          let predictedViolations = 0;
          let crewWithViolations = 0;
          let crewWithPredictedViolations = 0;
          let crewWithViolationsDetails: { name: string; rank: string }[] = [];
          let crewWithPredictedViolationsDetails: { name: string; rank: string }[] = [];
          const dailyRecords = dailyRecordsByVesselMonth.get(key) || [];
          
          if (dailyRecords.length > 0 && targetMonth) {
            // Calculate average percentage across all crew members on this vessel
            const percentages = dailyRecords.map(dr => 
              calculateRecordingPercentage(dr.dailyRecords, targetMonth)
            );
            const total = percentages.reduce((sum, p) => sum + p, 0);
            recordingPercent = Math.round(total / percentages.length);
            
            // Deduplicate daily records by crewMemberId to avoid counting same crew twice
            const uniqueDailyRecords = Array.from(
              new Map(dailyRecords.map(dr => [dr.crewMemberId, dr])).values()
            );
            
            // Sum up violations across unique crew members only
            totalViolations = uniqueDailyRecords.reduce((sum, dr) => 
              sum + countViolationDays(dr.dailyRecords, mode, isOpaMode, false), 0
            );
            predictedViolations = uniqueDailyRecords.reduce((sum, dr) => 
              sum + countViolationDays(dr.dailyRecords, mode, isOpaMode, true), 0
            );
            
            // Count crew members with violations (completed records only) using deduplicated records
            const crewWithViolationsRecords = uniqueDailyRecords.filter(dr => 
              hasViolationDays(dr.dailyRecords, mode, isOpaMode, false)
            );
            crewWithViolations = crewWithViolationsRecords.length;
            
            // Collect crew member details for violations
            crewWithViolationsDetails = crewWithViolationsRecords.map(dr => ({
              name: dr.name,
              rank: dr.rank
            }));
            
            // Count crew members with predicted violations using deduplicated records
            const crewWithPredictedViolationsRecords = uniqueDailyRecords.filter(dr => 
              hasViolationDays(dr.dailyRecords, mode, isOpaMode, true)
            );
            crewWithPredictedViolations = crewWithPredictedViolationsRecords.length;
            
            // Collect crew member details for predicted violations
            crewWithPredictedViolationsDetails = crewWithPredictedViolationsRecords.map(dr => ({
              name: dr.name,
              rank: dr.rank
            }));
          }
          
          // Calculate NCs across all crew members
          let totalNCs = 0;
          let predictedNCs = 0;
          let crewWithNCs = 0;
          let crewWithPredictedNCs = 0;
          let crewWithNCsDetails: { name: string; rank: string }[] = [];
          let crewWithPredictedNCsDetails: { name: string; rank: string }[] = [];
          
          if (dailyRecords.length > 0) {
            // Deduplicate daily records by crewMemberId
            const uniqueDailyRecords = Array.from(
              new Map(dailyRecords.map(dr => [dr.crewMemberId, dr])).values()
            );
            
            // Calculate NCs for each crew member and aggregate with crew details
            uniqueDailyRecords.forEach(dr => {
              const ncs = calculateNCs(dr.dailyRecords, mode, isOpaMode);
              totalNCs += ncs.totalNCs;
              predictedNCs += ncs.predictedNCs;
              if (ncs.totalNCs > 0) {
                crewWithNCs++;
                crewWithNCsDetails.push({ name: dr.name, rank: dr.rank });
              }
              if (ncs.predictedNCs > 0) {
                crewWithPredictedNCs++;
                crewWithPredictedNCsDetails.push({ name: dr.name, rank: dr.rank });
              }
            });
          }
          
          // Collect violation dates across all crew members on this vessel
          let violationDates: number[] = [];
          let predictedViolationDates: number[] = [];
          
          if (dailyRecords.length > 0) {
            // Deduplicate daily records by crewMemberId
            const uniqueDailyRecords = Array.from(
              new Map(dailyRecords.map(dr => [dr.crewMemberId, dr])).values()
            );
            
            // Collect all violation dates from all crew members
            const allViolationDates = new Set<number>();
            const allPredictedViolationDates = new Set<number>();
            
            uniqueDailyRecords.forEach(dr => {
              const completedDates = getViolationDates(dr.dailyRecords, mode, isOpaMode, false);
              const plannedDates = getViolationDates(dr.dailyRecords, mode, isOpaMode, true);
              
              completedDates.forEach(date => allViolationDates.add(date));
              plannedDates.forEach(date => allPredictedViolationDates.add(date));
            });
            
            violationDates = Array.from(allViolationDates).sort((a, b) => a - b);
            predictedViolationDates = Array.from(allPredictedViolationDates).sort((a, b) => a - b);
            
            // Debug logging for MT Nordic Star
            if (vesselId === 'VSL-003' && targetMonth === '2025-11') {
              console.log(`🔍 [DEBUG] VSL-003 violations - Mode: ${mode}, OPA: ${isOpaMode}`);
              console.log(`🔍 Total violation days: ${totalViolations}`);
              console.log(`🔍 Total unique crew with violations: ${crewWithViolations}`);
              console.log(`🔍 Daily records (before dedup): ${dailyRecords.length}`);
              console.log(`🔍 Daily records (after dedup): ${uniqueDailyRecords.length}`);
              uniqueDailyRecords.forEach(dr => {
                const vCount = countViolationDays(dr.dailyRecords, mode, isOpaMode, false);
                console.log(`  - ${dr.name} (${dr.rank}) - ${dr.crewMemberId}: ${vCount} violation days`);
              });
            }
          }
          
          const crewWithViolationsDetailsJson = crewWithViolationsDetails.length > 0 ? JSON.stringify(crewWithViolationsDetails) : null;
          const crewWithPredictedViolationsDetailsJson = crewWithPredictedViolationsDetails.length > 0 ? JSON.stringify(crewWithPredictedViolationsDetails) : null;
          const crewWithNCsDetailsJson = crewWithNCsDetails.length > 0 ? JSON.stringify(crewWithNCsDetails) : null;
          const crewWithPredictedNCsDetailsJson = crewWithPredictedNCsDetails.length > 0 ? JSON.stringify(crewWithPredictedNCsDetails) : null;
          const violationDatesJson = violationDates.length > 0 ? JSON.stringify(violationDates) : null;
          const predictedViolationDatesJson = predictedViolationDates.length > 0 ? JSON.stringify(predictedViolationDates) : null;
          
          if (persistedRecord) {
            // Calculate vessel review status
            const vesselReviewStatus = calculateVesselReviewStatus(
              targetMonth,
              persistedRecord.vesselReviewSubmittedDate
            );
            
            // Calculate office review status
            const officeReviewStatus = calculateOfficeReviewStatus(
              targetMonth,
              persistedRecord.vesselReviewSubmittedDate,
              persistedRecord.officeReviewSubmittedDate
            );
            
            // Use existing record with real crew count and calculated values
            return {
              ...persistedRecord,
              totalCrew: crewCountByVessel.get(vesselId) || 0,
              recordingStatusPercent: recordingPercent,
              totalViolations: totalViolations,
              predictedViolations: predictedViolations,
              crewWithViolations: crewWithViolations,
              crewWithPredictedViolations: crewWithPredictedViolations,
              crewWithViolationsDetails: crewWithViolationsDetailsJson,
              crewWithPredictedViolationsDetails: crewWithPredictedViolationsDetailsJson,
              violationDates: violationDatesJson,
              predictedViolationDates: predictedViolationDatesJson,
              totalNCs: totalNCs,
              crewWithNCs: crewWithNCs,
              crewWithNCsDetails: crewWithNCsDetailsJson,
              predictedNCs: predictedNCs,
              crewWithPredictedNCs: crewWithPredictedNCs,
              crewWithPredictedNCsDetails: crewWithPredictedNCsDetailsJson,
              crewWithActivityConflicts: 0,
              crewWithActivityConflictsDetails: null,
              vesselReviewStatus: vesselReviewStatus,
              officeReviewStatus: officeReviewStatus
            };
          } else {
            // Calculate vessel review status for new record
            const vesselReviewStatus = calculateVesselReviewStatus(targetMonth, null);
            
            // Calculate office review status for new record
            const officeReviewStatus = calculateOfficeReviewStatus(targetMonth, null, null);
            
            // Create placeholder record with calculated values
            return {
              id: null,
              vesselId,
              vesselName,
              monthValue: targetMonth,
              month: formatMonth(targetMonth),
              totalCrew: crewCountByVessel.get(vesselId) || 0,
              recordingStatusPercent: recordingPercent,
              activityConflicting: false,
              crewWithActivityConflicts: 0,
              crewWithActivityConflictsDetails: null,
              totalViolations: totalViolations,
              crewWithViolations: crewWithViolations,
              crewWithViolationsDetails: crewWithViolationsDetailsJson,
              violationDates: violationDatesJson,
              totalNCs: totalNCs,
              crewWithNCs: crewWithNCs,
              crewWithNCsDetails: crewWithNCsDetailsJson,
              predictedViolations: predictedViolations,
              crewWithPredictedViolations: crewWithPredictedViolations,
              crewWithPredictedViolationsDetails: crewWithPredictedViolationsDetailsJson,
              predictedViolationDates: predictedViolationDatesJson,
              predictedNCs: predictedNCs,
              crewWithPredictedNCs: crewWithPredictedNCs,
              crewWithPredictedNCsDetails: crewWithPredictedNCsDetailsJson,
              vesselReviewStatus: vesselReviewStatus,
              vesselReviewSubmittedDate: null,
              officeReviewSubmittedDate: null,
              officeReviewStatus: officeReviewStatus,
              createdAt: null,
              updatedAt: null,
            };
          }
        });
      } else {
        // No month filter - return all persisted records with enriched crew counts and calculated values
        allVesselRecords = persistedRecords.map(record => {
          const key = `${record.vesselId}-${record.monthValue}`;
          const dailyRecords = dailyRecordsByVesselMonth.get(key) || [];
          
          let recordingPercent = 0;
          let totalViolations = 0;
          let predictedViolations = 0;
          let crewWithViolations = 0;
          let crewWithPredictedViolations = 0;
          let crewWithViolationsDetails: { name: string; rank: string }[] = [];
          let crewWithPredictedViolationsDetails: { name: string; rank: string }[] = [];
          
          if (dailyRecords.length > 0 && record.monthValue) {
            const percentages = dailyRecords.map(dr => 
              calculateRecordingPercentage(dr.dailyRecords, record.monthValue)
            );
            const total = percentages.reduce((sum, p) => sum + p, 0);
            recordingPercent = Math.round(total / percentages.length);
            
            // Deduplicate daily records by crewMemberId to avoid counting same crew twice
            const uniqueDailyRecords = Array.from(
              new Map(dailyRecords.map(dr => [dr.crewMemberId, dr])).values()
            );
            
            // Sum up violations across unique crew members only
            totalViolations = uniqueDailyRecords.reduce((sum, dr) => 
              sum + countViolationDays(dr.dailyRecords, mode, isOpaMode, false), 0
            );
            predictedViolations = uniqueDailyRecords.reduce((sum, dr) => 
              sum + countViolationDays(dr.dailyRecords, mode, isOpaMode, true), 0
            );
            
            // Count crew members with violations (completed records only) using deduplicated records
            const crewWithViolationsRecords = uniqueDailyRecords.filter(dr => 
              hasViolationDays(dr.dailyRecords, mode, isOpaMode, false)
            );
            crewWithViolations = crewWithViolationsRecords.length;
            
            // Collect crew member details for violations
            crewWithViolationsDetails = crewWithViolationsRecords.map(dr => ({
              name: dr.name,
              rank: dr.rank
            }));
            
            // Count crew members with predicted violations using deduplicated records
            const crewWithPredictedViolationsRecords = uniqueDailyRecords.filter(dr => 
              hasViolationDays(dr.dailyRecords, mode, isOpaMode, true)
            );
            crewWithPredictedViolations = crewWithPredictedViolationsRecords.length;
            
            // Collect crew member details for predicted violations
            crewWithPredictedViolationsDetails = crewWithPredictedViolationsRecords.map(dr => ({
              name: dr.name,
              rank: dr.rank
            }));
            
            // Collect violation dates across all crew members
            const allViolationDates = new Set<number>();
            const allPredictedViolationDates = new Set<number>();
            
            uniqueDailyRecords.forEach(dr => {
              const completedDates = getViolationDates(dr.dailyRecords, mode, isOpaMode, false);
              const plannedDates = getViolationDates(dr.dailyRecords, mode, isOpaMode, true);
              
              completedDates.forEach(date => allViolationDates.add(date));
              plannedDates.forEach(date => allPredictedViolationDates.add(date));
            });
            
            const violationDates = Array.from(allViolationDates).sort((a, b) => a - b);
            const predictedViolationDates = Array.from(allPredictedViolationDates).sort((a, b) => a - b);
            
            // Calculate NCs for each crew member and aggregate with crew details
            let totalNCs = 0;
            let predictedNCs = 0;
            let crewWithNCs = 0;
            let crewWithPredictedNCs = 0;
            let crewWithNCsDetails: { name: string; rank: string }[] = [];
            let crewWithPredictedNCsDetails: { name: string; rank: string }[] = [];
            
            uniqueDailyRecords.forEach(dr => {
              const ncs = calculateNCs(dr.dailyRecords, mode, isOpaMode);
              totalNCs += ncs.totalNCs;
              predictedNCs += ncs.predictedNCs;
              if (ncs.totalNCs > 0) {
                crewWithNCs++;
                crewWithNCsDetails.push({ name: dr.name, rank: dr.rank });
              }
              if (ncs.predictedNCs > 0) {
                crewWithPredictedNCs++;
                crewWithPredictedNCsDetails.push({ name: dr.name, rank: dr.rank });
              }
            });
            
            // Calculate vessel review status
            const vesselReviewStatus = calculateVesselReviewStatus(
              record.monthValue,
              record.vesselReviewSubmittedDate
            );
            
            // Calculate office review status
            const officeReviewStatus = calculateOfficeReviewStatus(
              record.monthValue,
              record.vesselReviewSubmittedDate,
              record.officeReviewSubmittedDate
            );
            
            return {
              ...record,
              totalCrew: crewCountByVessel.get(record.vesselId) || 0,
              recordingStatusPercent: recordingPercent,
              totalViolations: totalViolations,
              predictedViolations: predictedViolations,
              crewWithViolations: crewWithViolations,
              crewWithPredictedViolations: crewWithPredictedViolations,
              crewWithViolationsDetails: JSON.stringify(crewWithViolationsDetails),
              crewWithPredictedViolationsDetails: JSON.stringify(crewWithPredictedViolationsDetails),
              violationDates: violationDates.length > 0 ? JSON.stringify(violationDates) : null,
              predictedViolationDates: predictedViolationDates.length > 0 ? JSON.stringify(predictedViolationDates) : null,
              totalNCs: totalNCs,
              crewWithNCs: crewWithNCs,
              crewWithNCsDetails: crewWithNCsDetails.length > 0 ? JSON.stringify(crewWithNCsDetails) : null,
              predictedNCs: predictedNCs,
              crewWithPredictedNCs: crewWithPredictedNCs,
              crewWithPredictedNCsDetails: crewWithPredictedNCsDetails.length > 0 ? JSON.stringify(crewWithPredictedNCsDetails) : null,
              crewWithActivityConflicts: 0,
              crewWithActivityConflictsDetails: null,
              vesselReviewStatus: vesselReviewStatus,
              officeReviewStatus: officeReviewStatus
            };
          }
          
          // Calculate vessel review status for records without daily records
          const vesselReviewStatus = calculateVesselReviewStatus(
            record.monthValue,
            record.vesselReviewSubmittedDate
          );
          
          // Calculate office review status for records without daily records
          const officeReviewStatus = calculateOfficeReviewStatus(
            record.monthValue,
            record.vesselReviewSubmittedDate,
            record.officeReviewSubmittedDate
          );
          
          return {
            ...record,
            totalCrew: crewCountByVessel.get(record.vesselId) || 0,
            recordingStatusPercent: 0,
            totalViolations: 0,
            predictedViolations: 0,
            crewWithViolations: 0,
            crewWithPredictedViolations: 0,
            crewWithViolationsDetails: null,
            crewWithPredictedViolationsDetails: null,
            violationDates: null,
            predictedViolationDates: null,
            totalNCs: 0,
            crewWithNCs: 0,
            crewWithNCsDetails: null,
            predictedNCs: 0,
            crewWithPredictedNCs: 0,
            crewWithPredictedNCsDetails: null,
            crewWithActivityConflicts: 0,
            crewWithActivityConflictsDetails: null,
            vesselReviewStatus: vesselReviewStatus,
            officeReviewStatus: officeReviewStatus
          };
        });
      }
      
      const filteredRecords = allVesselRecords;
      
      res.json(filteredRecords);
    } catch (error) {
      console.error("Failed to fetch rest hours vessel records:", error);
      res.status(500).json({ error: "Failed to fetch rest hours vessel records" });
    }
  });

  app.get("/api/rest-hours-vessel-records/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const record = await storage.getRestHoursVesselRecord(id);
      if (!record) {
        return res.status(404).json({ error: "Rest hours vessel record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Failed to fetch rest hours vessel record:", error);
      res.status(500).json({ error: "Failed to fetch rest hours vessel record" });
    }
  });

  app.post("/api/rest-hours-vessel-records", async (req, res) => {
    try {
      const result = insertRestHoursVesselRecordSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid rest hours vessel record data", details: result.error.issues });
      }
      const record = await storage.createRestHoursVesselRecord(result.data);
      res.status(201).json(record);
    } catch (error) {
      console.error("Failed to create rest hours vessel record:", error);
      res.status(500).json({ error: "Failed to create rest hours vessel record" });
    }
  });

  app.put("/api/rest-hours-vessel-records/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const result = insertRestHoursVesselRecordSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid rest hours vessel record data", details: result.error.issues });
      }
      const record = await storage.updateRestHoursVesselRecord(id, result.data);
      if (!record) {
        return res.status(404).json({ error: "Rest hours vessel record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Failed to update rest hours vessel record:", error);
      res.status(500).json({ error: "Failed to update rest hours vessel record" });
    }
  });

  app.delete("/api/rest-hours-vessel-records/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const deleted = await storage.deleteRestHoursVesselRecord(id);
      if (!deleted) {
        return res.status(404).json({ error: "Rest hours vessel record not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete rest hours vessel record:", error);
      res.status(500).json({ error: "Failed to delete rest hours vessel record" });
    }
  });

  // Helper function to get visible violation codes based on compliance mode and OPA mode
  function getVisibleViolationCodes(complianceMode: string, opaMode: boolean): number[] {
    const codes: number[] = [];
    
    // Add codes based on compliance mode
    if (complianceMode === 'Rest') {
      codes.push(1, 2, 3, 4); // Rest mode violations
    } else {
      codes.push(5, 6); // Work mode violations
    }
    
    // Add OPA codes if OPA mode is enabled
    if (opaMode) {
      codes.push(7, 8);
    }
    
    return codes;
  }

  // Rest Hours Violations By Rank (Dashboard Chart)
  app.get("/api/rest-hours-violations-by-rank", async (req, res) => {
    try {
      const { vesselIds, monthValue, complianceMode = 'Rest', opaMode = 'false' } = req.query;
      
      const isOpaMode = opaMode === 'true';
      const visibleViolationCodes = getVisibleViolationCodes(complianceMode as string, isOpaMode);
      
      // Get all daily records
      const allDailyRecords = await storage.getRestHoursDailyRecords();
      
      // Filter daily records by vessel and month
      let filteredRecords = allDailyRecords;
      
      if (vesselIds) {
        const vesselIdArray = typeof vesselIds === 'string' ? [vesselIds] : vesselIds as string[];
        filteredRecords = filteredRecords.filter((record: any) => 
          vesselIdArray.includes(record.vesselId)
        );
      }
      
      if (monthValue) {
        filteredRecords = filteredRecords.filter((record: any) => 
          record.monthYear === monthValue
        );
      }
      
      // Aggregate violation days by rank
      const violationsByRank = new Map<string, number>();
      
      filteredRecords.forEach((record: any) => {
        try {
          const dailyRecords = JSON.parse(record.dailyRecords);
          const rank = record.rank;
          
          // Count days with violations (only actual violations, not predicted)
          // AND filter by compliance mode and OPA setting
          let violationDays = 0;
          dailyRecords.forEach((day: any) => {
            // Only count violations from actual recorded hours (isPlan === false)
            // Skip planned hours (isPlan === true) which represent predicted violations
            if (day.isPlan === false && day.violations && Array.isArray(day.violations)) {
              // Filter violations to only include codes visible in current compliance mode
              const filteredViolations = day.violations.filter((code: number) => 
                visibleViolationCodes.includes(code)
              );
              
              if (filteredViolations.length > 0) {
                violationDays++;
              }
            }
          });
          
          // Add to rank total
          if (violationDays > 0) {
            const currentTotal = violationsByRank.get(rank) || 0;
            violationsByRank.set(rank, currentTotal + violationDays);
          }
        } catch (error) {
          console.error(`Failed to parse daily records for record ${record.id}:`, error);
        }
      });
      
      // Convert to array and sort by violation days descending
      const result = Array.from(violationsByRank.entries())
        .map(([rank, violationDays]) => ({ rank, violationDays }))
        .sort((a, b) => b.violationDays - a.violationDays);
      
      res.json(result);
    } catch (error) {
      console.error("Failed to get violations by rank:", error);
      res.status(500).json({ error: "Failed to get violations by rank" });
    }
  });

  // Rest Hours NCs By Rank (Dashboard Chart)
  app.get("/api/rest-hours-ncs-by-rank", async (req, res) => {
    try {
      const { vesselIds, monthValue, complianceMode, opaMode } = req.query;
      
      // Parse compliance mode and OPA mode (default to Rest and false)
      const mode: 'Rest' | 'Work' = (complianceMode as string) === 'Work' ? 'Work' : 'Rest';
      const isOpaMode = opaMode === 'true';
      
      // Get all daily records
      const allDailyRecords = await storage.getRestHoursDailyRecords();
      
      // Filter daily records by vessel and month
      let filteredRecords = allDailyRecords;
      
      if (vesselIds) {
        const vesselIdArray = typeof vesselIds === 'string' ? [vesselIds] : vesselIds as string[];
        filteredRecords = filteredRecords.filter((record: any) => 
          vesselIdArray.includes(record.vesselId)
        );
      }
      
      if (monthValue) {
        filteredRecords = filteredRecords.filter((record: any) => 
          record.monthYear === monthValue
        );
      }
      
      // Count crew members with NCs by rank
      // Note: Max 1 NC per crew member per month (binary flag)
      // NC occurs when: 3+ violation days OR Code [2] violation
      
      // First, deduplicate records by crew member ID to handle duplicate entries
      const uniqueRecords = new Map<string, any>();
      filteredRecords.forEach((record: any) => {
        const key = `${record.crewMemberId}-${record.vesselId}-${record.monthYear}`;
        // Keep the record with the highest ID (most recent)
        if (!uniqueRecords.has(key) || record.id > uniqueRecords.get(key).id) {
          uniqueRecords.set(key, record);
        }
      });
      
      const ncsByRank = new Map<string, number>();
      
      uniqueRecords.forEach((record: any) => {
        try {
          const rank = record.rank;
          
          // Use the proper calculateNCs function to determine if crew has NC
          const { totalNCs } = calculateNCs(record.dailyRecords, mode, isOpaMode);
          
          // If crew has NC (totalNCs = 1), increment count for their rank
          if (totalNCs > 0) {
            const currentCount = ncsByRank.get(rank) || 0;
            ncsByRank.set(rank, currentCount + 1);
          }
        } catch (error) {
          console.error(`Failed to calculate NCs for record ${record.id}:`, error);
        }
      });
      
      // Convert to array and sort by NC count descending
      const result = Array.from(ncsByRank.entries())
        .map(([rank, ncCount]) => ({ rank, ncCount }))
        .sort((a, b) => b.ncCount - a.ncCount);
      
      res.json(result);
    } catch (error) {
      console.error("Failed to get NCs by rank:", error);
      res.status(500).json({ error: "Failed to get NCs by rank" });
    }
  });

  // Rest Hours Crew Records API routes
  app.get("/api/rest-hours-crew-records", async (req, res) => {
    try {
      const { vesselIds, monthValue, ranks, search, complianceMode, opaMode } = req.query;
      
      // Parse compliance mode and OPA mode (default to Rest and false)
      const mode: 'Rest' | 'Work' = (complianceMode as string) === 'Work' ? 'Work' : 'Rest';
      const isOpaMode = opaMode === 'true';
      
      // Get all crew members from storage
      const allCrewMembers = await storage.getCrewMembers();
      
      // Get persisted crew records from storage (if any exist)
      const persistedRecords = await storage.getRestHoursCrewRecords();
      const persistedRecordsMap = new Map<string, any>();
      persistedRecords.forEach(record => {
        const key = `${record.crewMemberId}-${record.vesselId}-${record.monthValue}`;
        persistedRecordsMap.set(key, record);
      });
      
      // Get vessel master data for dynamic name/ID mapping
      const vesselMasterData = await storage.getMasterDataEntries('014');
      
      // Build comprehensive vessel name ↔ ID maps from master data
      const vesselNameToIdMap = new Map<string, string>();
      const vesselIdToNameMap = new Map<string, string>();
      vesselMasterData.forEach((entry: any) => {
        const entryId = entry.entryId || entry.entry_id;
        if (!entryId) return;
        
        // Map all possible name fields to the canonical ID
        if (entry.name) vesselNameToIdMap.set(entry.name, entryId);
        if (entry.label) vesselNameToIdMap.set(entry.label, entryId);
        if (entry.vessel) vesselNameToIdMap.set(entry.vessel, entryId);
        
        // Map the ID to itself for direct ID lookups
        vesselNameToIdMap.set(entryId, entryId);
        
        // Store ID → name mapping
        const displayName = entry.name || entry.label || entry.vessel || entryId;
        vesselIdToNameMap.set(entryId, displayName);
      });
      
      // Helper function to get vessel ID
      const getVesselId = (crew: any): string | null => {
        const vesselName = crew.presentVessel || crew.vessel;
        if (!vesselName || vesselName === '') return null;
        return vesselNameToIdMap.get(vesselName) || null;
      };
      
      // Helper function to format sign-on/off info
      const getSignOnOffInfo = (crew: any): string => {
        if (crew.signOnDate) {
          const date = new Date(crew.signOnDate);
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const day = date.getDate();
          const month = monthNames[date.getMonth()];
          const year = date.getFullYear();
          
          const isOfficer = ['Master', 'Chief Officer', 'Chief Engineer', '2nd Officer', '3rd Officer', '2nd Engineer', '3rd Engineer'].includes(crew.presentRank || crew.rank || '');
          const role = isOfficer ? 'Officer' : 'Rating';
          
          return `S.On / ${day}-${month}-${year} / ${role}`;
        }
        return '';
      };
      
      // Format month display from monthValue
      const formatMonth = (monthVal: string): string => {
        if (!monthVal) return '';
        const [year, month] = monthVal.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndex = parseInt(month) - 1;
        return `${monthNames[monthIndex]}-${year}`;
      };
      
      // Determine target month
      const targetMonth = monthValue as string || '';
      
      // Get all daily records for calculating percentages
      const allDailyRecords = await storage.getRestHoursDailyRecords();
      const dailyRecordsMap = new Map<string, any>();
      allDailyRecords.forEach(record => {
        const key = `${record.crewMemberId}-${record.vesselId}-${record.monthYear}`;
        const existing = dailyRecordsMap.get(key);
        // If duplicate exists, keep the one with higher ID (most recent)
        // Use numeric comparison to handle string IDs correctly
        const recordIdNum = Number(record.id);
        const existingIdNum = existing ? Number(existing.id) : -1;
        if (!existing || recordIdNum > existingIdNum) {
          dailyRecordsMap.set(key, record);
        }
      });
      
      // Generate crew records with left-join to persisted records
      const crewRecords = allCrewMembers
        .filter(crew => {
          const vesselId = getVesselId(crew);
          return vesselId !== null;
        })
        .map((crew, index) => {
          const crewAny = crew as any; // Cast for legacy field access
          const vesselId = getVesselId(crew)!;
          const vesselName = vesselIdToNameMap.get(vesselId) || crew.presentVessel || crewAny.vessel || '';
          const rank = crew.presentRank || crewAny.rank || 'Unknown';
          const fullName = `${crew.firstName || ''} ${crew.familyName || crewAny.lastName || ''}`.trim();
          const crewMemberId = crew.id || `${fullName}-${rank}-${vesselId}`;
          
          // Look up persisted record and daily record for this crew/vessel/month
          const key = `${crewMemberId}-${vesselId}-${targetMonth}`;
          const persistedRecord = persistedRecordsMap.get(key);
          const dailyRecord = dailyRecordsMap.get(key);
          
          // Always calculate actual percentage and violations from daily records
          let recordingPercent = 0;
          let totalViolations = 0;
          let predictedViolations = 0;
          let violationDates: number[] = [];
          let predictedViolationDates: number[] = [];
          let totalNCs = 0;
          let predictedNCs = 0;
          
          if (dailyRecord && targetMonth) {
            recordingPercent = calculateRecordingPercentage(dailyRecord.dailyRecords, targetMonth);
            // Count completed violations (isPlan = false)
            totalViolations = countViolationDays(dailyRecord.dailyRecords, mode, isOpaMode, false);
            // Count predicted violations (isPlan = true)
            predictedViolations = countViolationDays(dailyRecord.dailyRecords, mode, isOpaMode, true);
            // Get violation dates
            violationDates = getViolationDates(dailyRecord.dailyRecords, mode, isOpaMode, false);
            predictedViolationDates = getViolationDates(dailyRecord.dailyRecords, mode, isOpaMode, true);
            // Calculate NCs
            const ncs = calculateNCs(dailyRecord.dailyRecords, mode, isOpaMode);
            totalNCs = ncs.totalNCs;
            predictedNCs = ncs.predictedNCs;
          }
          
          const violationDatesJson = violationDates.length > 0 ? JSON.stringify(violationDates) : null;
          const predictedViolationDatesJson = predictedViolationDates.length > 0 ? JSON.stringify(predictedViolationDates) : null;
          
          if (persistedRecord) {
            // Use existing record but update calculated values from daily records
            return {
              ...persistedRecord,
              recordingStatusPercent: recordingPercent,
              totalViolations: totalViolations,
              predictedViolations: predictedViolations,
              violationDates: violationDatesJson,
              predictedViolationDates: predictedViolationDatesJson,
              totalNCs: totalNCs,
              predictedNCs: predictedNCs
            };
          } else {
            // Create placeholder record with calculated values
            return {
              id: null,
              vesselId,
              vesselName,
              crewMemberId,
              rank,
              name: fullName,
              month: formatMonth(targetMonth),
              monthValue: targetMonth,
              signOnOffInfo: getSignOnOffInfo(crew),
              recordingStatusPercent: recordingPercent,
              activityConflicting: false,
              totalViolations: totalViolations,
              violationDates: violationDatesJson,
              totalNCs: totalNCs,
              predictedViolations: predictedViolations,
              predictedViolationDates: predictedViolationDatesJson,
              predictedNCs: predictedNCs,
              createdAt: null,
              updatedAt: null,
            };
          }
        });
      
      // Apply filters
      let filteredRecords = crewRecords;
      
      if (vesselIds && Array.isArray(vesselIds) && vesselIds.length > 0) {
        const vesselIdArray = typeof vesselIds === 'string' ? [vesselIds] : vesselIds;
        filteredRecords = filteredRecords.filter(record => vesselIdArray.includes(record.vesselId));
      } else if (vesselIds && typeof vesselIds === 'string') {
        filteredRecords = filteredRecords.filter(record => record.vesselId === vesselIds);
      }
      
      if (targetMonth) {
        filteredRecords = filteredRecords.filter(record => record.monthValue === targetMonth);
      }
      
      if (ranks) {
        const ranksArray = Array.isArray(ranks) ? ranks : [ranks as string];
        filteredRecords = filteredRecords.filter(record => (ranksArray as string[]).includes(record.rank));
      }
      
      if (search && typeof search === 'string') {
        const searchLower = search.toLowerCase();
        filteredRecords = filteredRecords.filter(record =>
          record.name.toLowerCase().includes(searchLower) ||
          record.crewMemberId.toLowerCase().includes(searchLower)
        );
      }
      
      res.json(filteredRecords);
    } catch (error) {
      console.error("Failed to fetch rest hours crew records:", error);
      res.status(500).json({ error: "Failed to fetch rest hours crew records" });
    }
  });

  app.get("/api/rest-hours-crew-records/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const record = await storage.getRestHoursCrewRecord(id);
      if (!record) {
        return res.status(404).json({ error: "Rest hours crew record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Failed to fetch rest hours crew record:", error);
      res.status(500).json({ error: "Failed to fetch rest hours crew record" });
    }
  });

  app.post("/api/rest-hours-crew-records", async (req, res) => {
    try {
      const result = insertRestHoursCrewRecordSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid rest hours crew record data", details: result.error.issues });
      }
      const record = await storage.createRestHoursCrewRecord(result.data);
      res.status(201).json(record);
    } catch (error) {
      console.error("Failed to create rest hours crew record:", error);
      res.status(500).json({ error: "Failed to create rest hours crew record" });
    }
  });

  app.put("/api/rest-hours-crew-records/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const result = insertRestHoursCrewRecordSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid rest hours crew record data", details: result.error.issues });
      }
      const record = await storage.updateRestHoursCrewRecord(id, result.data);
      if (!record) {
        return res.status(404).json({ error: "Rest hours crew record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Failed to update rest hours crew record:", error);
      res.status(500).json({ error: "Failed to update rest hours crew record" });
    }
  });

  app.delete("/api/rest-hours-crew-records/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const deleted = await storage.deleteRestHoursCrewRecord(id);
      if (!deleted) {
        return res.status(404).json({ error: "Rest hours crew record not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete rest hours crew record:", error);
      res.status(500).json({ error: "Failed to delete rest hours crew record" });
    }
  });

  // Rest Hours Daily Records API routes
  app.get("/api/rest-hours-daily-records", async (req, res) => {
    try {
      const records = await storage.getRestHoursDailyRecords();
      res.json(records);
    } catch (error) {
      console.error("Failed to get rest hours daily records:", error);
      res.status(500).json({ error: "Failed to get rest hours daily records" });
    }
  });

  app.get("/api/rest-hours-daily-records/by-key/:crewMemberId/:vesselId/:monthYear", async (req, res) => {
    try {
      const { crewMemberId, vesselId, monthYear } = req.params;
      const record = await storage.getRestHoursDailyRecordByKey(crewMemberId, vesselId, monthYear);
      if (!record) {
        return res.status(404).json({ error: "Rest hours daily record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Failed to get rest hours daily record by key:", error);
      res.status(500).json({ error: "Failed to get rest hours daily record by key" });
    }
  });

  app.get("/api/rest-hours-daily-records/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const record = await storage.getRestHoursDailyRecord(id);
      if (!record) {
        return res.status(404).json({ error: "Rest hours daily record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Failed to get rest hours daily record:", error);
      res.status(500).json({ error: "Failed to get rest hours daily record" });
    }
  });

  app.post("/api/rest-hours-daily-records", async (req, res) => {
    try {
      const result = insertRestHoursDailyRecordSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid rest hours daily record data", details: result.error.issues });
      }
      const record = await storage.createRestHoursDailyRecord(result.data);
      
      // Recalculate activity conflicts for this vessel/month after creating RH record
      await recalculateActivityConflicts(record.vesselId, record.monthYear);
      
      res.status(201).json(record);
    } catch (error) {
      console.error("Failed to create rest hours daily record:", error);
      res.status(500).json({ error: "Failed to create rest hours daily record" });
    }
  });

  app.put("/api/rest-hours-daily-records/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const result = insertRestHoursDailyRecordSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid rest hours daily record data", details: result.error.issues });
      }
      const record = await storage.updateRestHoursDailyRecord(id, result.data);
      if (!record) {
        return res.status(404).json({ error: "Rest hours daily record not found" });
      }
      
      // Update recording percentages after saving
      await updateRecordingPercentages(record.crewMemberId, record.vesselId, record.monthYear);
      
      // Recalculate activity conflicts for this vessel/month after updating RH record
      await recalculateActivityConflicts(record.vesselId, record.monthYear);
      
      res.json(record);
    } catch (error) {
      console.error("Failed to update rest hours daily record:", error);
      res.status(500).json({ error: "Failed to update rest hours daily record" });
    }
  });

  app.delete("/api/rest-hours-daily-records/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid record ID - must be a number" });
      }
      const deleted = await storage.deleteRestHoursDailyRecord(id);
      if (!deleted) {
        return res.status(404).json({ error: "Rest hours daily record not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete rest hours daily record:", error);
      res.status(500).json({ error: "Failed to delete rest hours daily record" });
    }
  });

  // Vessel Date Line Adjustments API routes
  app.get("/api/vessel-dateline-adjustments/:vesselId/:monthValue", async (req, res) => {
    try {
      const { vesselId, monthValue } = req.params;
      
      if (!monthValue.match(/^\d{4}-\d{2}$/)) {
        return res.status(400).json({ error: "monthValue must be in YYYY-MM format" });
      }
      
      const adjustment = await storage.getVesselDateLineAdjustment(vesselId, monthValue);
      if (!adjustment) {
        return res.status(404).json({ error: "Vessel date line adjustment not found" });
      }
      res.json(adjustment);
    } catch (error) {
      console.error("Failed to get vessel date line adjustment:", error);
      res.status(500).json({ error: "Failed to get vessel date line adjustment" });
    }
  });

  app.put("/api/vessel-dateline-adjustments/:vesselId/:monthValue", async (req, res) => {
    try {
      const { vesselId, monthValue } = req.params;
      const result = insertVesselDateLineAdjustmentSchema.safeParse({
        vesselId,
        monthValue,
        adjustments: req.body.adjustments
      });
      if (!result.success) {
        return res.status(400).json({ error: "Invalid vessel date line adjustment data", details: result.error.issues });
      }
      const adjustment = await storage.saveVesselDateLineAdjustment(result.data);
      
      try {
        const adjustmentsArray = JSON.parse(result.data.adjustments);
        const advancedDays = adjustmentsArray
          .filter((adj: any) => adj.type === 'advanced')
          .map((adj: any) => adj.day);
        
        if (advancedDays.length > 0) {
          await storage.clearAdvancedDaysData(vesselId, monthValue, advancedDays);
        }
      } catch (e) {
        console.error("Failed to clear advanced days data:", e);
      }
      
      res.json(adjustment);
    } catch (error) {
      console.error("Failed to save vessel date line adjustment:", error);
      res.status(500).json({ error: "Failed to save vessel date line adjustment" });
    }
  });

  app.delete("/api/vessel-dateline-adjustments/:vesselId/:monthValue", async (req, res) => {
    try {
      const { vesselId, monthValue } = req.params;
      
      if (!monthValue.match(/^\d{4}-\d{2}$/)) {
        return res.status(400).json({ error: "monthValue must be in YYYY-MM format" });
      }
      
      const deleted = await storage.deleteVesselDateLineAdjustment(vesselId, monthValue);
      if (!deleted) {
        return res.status(404).json({ error: "Vessel date line adjustment not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete vessel date line adjustment:", error);
      res.status(500).json({ error: "Failed to delete vessel date line adjustment" });
    }
  });

  // Vessel Violation Comments API routes
  app.get("/api/vessel-violation-comments", async (req, res) => {
    try {
      const { vesselId, monthValue } = req.query;
      
      if (!vesselId || !monthValue) {
        return res.status(400).json({ error: "vesselId and monthValue are required" });
      }
      
      const comment = await storage.getVesselViolationComment(vesselId as string, monthValue as string);
      res.json(comment);
    } catch (error) {
      console.error("Failed to get vessel violation comment:", error);
      res.status(500).json({ error: "Failed to get vessel violation comment" });
    }
  });

  app.post("/api/vessel-violation-comments", async (req, res) => {
    try {
      const result = insertVesselViolationCommentSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid vessel violation comment data", details: result.error.issues });
      }
      const comment = await storage.saveVesselViolationComment(result.data);
      res.status(201).json(comment);
    } catch (error) {
      console.error("Failed to save vessel violation comment:", error);
      res.status(500).json({ error: "Failed to save vessel violation comment" });
    }
  });

  // Office Violation Comments API routes
  app.get("/api/office-violation-comments", async (req, res) => {
    try {
      const { vesselId, monthValue } = req.query;
      
      if (!vesselId || !monthValue) {
        return res.status(400).json({ error: "vesselId and monthValue are required" });
      }
      
      const comment = await storage.getOfficeViolationComment(vesselId as string, monthValue as string);
      res.json(comment);
    } catch (error) {
      console.error("Failed to get office violation comment:", error);
      res.status(500).json({ error: "Failed to get office violation comment" });
    }
  });

  app.post("/api/office-violation-comments", async (req, res) => {
    try {
      const result = insertOfficeViolationCommentSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid office violation comment data", details: result.error.issues });
      }
      
      // Validate required fields
      const { comment, reviewerName, reviewDate } = result.data;
      
      if (!comment || comment.trim() === '') {
        return res.status(400).json({ error: "Comment is required and cannot be empty" });
      }
      
      if (!reviewerName || reviewerName.trim() === '') {
        return res.status(400).json({ error: "Reviewer name is required and cannot be empty" });
      }
      
      if (!reviewDate) {
        return res.status(400).json({ error: "Review date is required" });
      }
      
      const savedComment = await storage.saveOfficeViolationComment(result.data);
      res.status(201).json(savedComment);
    } catch (error) {
      console.error("Failed to save office violation comment:", error);
      res.status(500).json({ error: "Failed to save office violation comment" });
    }
  });

  // Vessel Review Submission API route
  app.post("/api/rest-hours-vessel-records/submit-review", async (req, res) => {
    try {
      const { vesselId, monthValue } = req.body;
      
      if (!vesselId || !monthValue) {
        return res.status(400).json({ error: "vesselId and monthValue are required" });
      }
      
      // Find the vessel record
      const vesselRecords = await storage.getRestHoursVesselRecordsByFilters({
        vesselIds: [vesselId],
        monthValue
      });
      
      const existingVesselRecord = vesselRecords.find(r => r.vesselId === vesselId && r.monthValue === monthValue);
      
      if (!existingVesselRecord) {
        return res.status(404).json({ error: "Vessel record not found" });
      }
      
      // Update the vessel record with submission date
      const updatedRecord = await storage.updateRestHoursVesselRecord(existingVesselRecord.id, {
        vesselReviewSubmittedDate: new Date(),
      });
      
      res.status(200).json(updatedRecord);
    } catch (error) {
      console.error("Failed to submit vessel review:", error);
      res.status(500).json({ error: "Failed to submit vessel review" });
    }
  });

  // Office Review Submission API route
  app.post("/api/rest-hours-vessel-records/submit-office-review", async (req, res) => {
    try {
      const { vesselId, monthValue } = req.body;
      
      if (!vesselId || !monthValue) {
        return res.status(400).json({ error: "vesselId and monthValue are required" });
      }
      
      // Check if office violation comment exists and is valid
      const officeComment = await storage.getOfficeViolationComment(vesselId, monthValue);
      
      if (!officeComment) {
        return res.status(400).json({ error: "Office violation comment must be saved before submitting office review" });
      }
      
      if (!officeComment.reviewerName || officeComment.reviewerName.trim() === '') {
        return res.status(400).json({ error: "Office violation comment must have a reviewer name before submitting" });
      }
      
      if (!officeComment.reviewDate) {
        return res.status(400).json({ error: "Office violation comment must have a review date before submitting" });
      }
      
      // Find the vessel record
      const vesselRecords = await storage.getRestHoursVesselRecordsByFilters({
        vesselIds: [vesselId],
        monthValue
      });
      
      const existingVesselRecord = vesselRecords.find(r => r.vesselId === vesselId && r.monthValue === monthValue);
      
      if (!existingVesselRecord) {
        return res.status(404).json({ error: "Vessel record not found" });
      }
      
      // Update the vessel record with office review submission date
      const updatedRecord = await storage.updateRestHoursVesselRecord(existingVesselRecord.id, {
        officeReviewSubmittedDate: new Date(),
      });
      
      res.status(200).json(updatedRecord);
    } catch (error) {
      console.error("Failed to submit office review:", error);
      res.status(500).json({ error: "Failed to submit office review" });
    }
  });

  // NC Reports API routes
  app.get("/api/nc-reports/all", async (req, res) => {
    try {
      const reports = await storage.getAllNCReports();
      res.json(reports);
    } catch (error) {
      console.error("Failed to get all NC reports:", error);
      res.status(500).json({ error: "Failed to get all NC reports" });
    }
  });

  app.get("/api/nc-reports", async (req, res) => {
    try {
      const { crewMemberId, vesselId, monthValue } = req.query;
      
      if (!crewMemberId || !vesselId || !monthValue) {
        return res.status(400).json({ error: "crewMemberId, vesselId, and monthValue are required" });
      }
      
      const report = await storage.getNCReport(crewMemberId as string, vesselId as string, monthValue as string);
      res.json(report);
    } catch (error) {
      console.error("Failed to get NC report:", error);
      res.status(500).json({ error: "Failed to get NC report" });
    }
  });

  app.post("/api/nc-reports", async (req, res) => {
    try {
      const result = insertNCReportSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid NC report data", details: result.error.issues });
      }
      const report = await storage.saveNCReport(result.data);
      res.status(201).json(report);
    } catch (error) {
      console.error("Failed to save NC report:", error);
      res.status(500).json({ error: "Failed to save NC report" });
    }
  });

  // Variable Tasks API routes
  app.get("/api/variable-tasks", async (req, res) => {
    try {
      const { vesselId, periodValue } = req.query;
      
      if (vesselId || periodValue) {
        const tasks = await storage.getVariableTasksByFilters({
          vesselId: vesselId as string,
          periodValue: periodValue as string
        });
        res.json(tasks);
      } else {
        const tasks = await storage.getVariableTasks();
        res.json(tasks);
      }
    } catch (error) {
      console.error("Failed to get variable tasks:", error);
      res.status(500).json({ error: "Failed to get variable tasks" });
    }
  });

  app.get("/api/variable-tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid task ID - must be a number" });
      }
      const task = await storage.getVariableTask(id);
      if (!task) {
        return res.status(404).json({ error: "Variable task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Failed to get variable task:", error);
      res.status(500).json({ error: "Failed to get variable task" });
    }
  });

  app.post("/api/variable-tasks", async (req, res) => {
    try {
      const result = insertVariableTaskSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid variable task data", details: result.error.issues });
      }
      const task = await storage.createVariableTask(result.data);
      
      // Sync to RH records if submitted (not draft)
      await syncVariableTaskToRHRecords(task);
      
      res.status(201).json(task);
    } catch (error) {
      console.error("Failed to create variable task:", error);
      res.status(500).json({ error: "Failed to create variable task" });
    }
  });

  app.patch("/api/variable-tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid task ID - must be a number" });
      }
      
      // Get old task for comparison
      const oldTask = await storage.getVariableTask(id);
      
      const result = insertVariableTaskSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid variable task data", details: result.error.issues });
      }
      const task = await storage.updateVariableTask(id, result.data);
      if (!task) {
        return res.status(404).json({ error: "Variable task not found" });
      }
      
      // Sync to RH records (will remove old 'a' codes for planned tasks and add new ones)
      await syncVariableTaskToRHRecords(task, oldTask);
      
      res.json(task);
    } catch (error) {
      console.error("Failed to update variable task:", error);
      res.status(500).json({ error: "Failed to update variable task" });
    }
  });

  app.delete("/api/variable-tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid task ID - must be a number" });
      }
      
      // Get task before deletion to remove 'a' codes from RH records (only for planned tasks)
      const task = await storage.getVariableTask(id);
      if (task) {
        await removeVariableTaskFromRHRecords(task);
      }
      
      const deleted = await storage.deleteVariableTask(id);
      if (!deleted) {
        return res.status(404).json({ error: "Variable task not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete variable task:", error);
      res.status(500).json({ error: "Failed to delete variable task" });
    }
  });

  // Fixed Tasks API routes
  app.get("/api/fixed-tasks", async (req, res) => {
    try {
      const { vesselId, monthYear } = req.query;
      
      if (vesselId && monthYear) {
        const tasks = await storage.getFixedTasksByVesselAndMonth(vesselId as string, monthYear as string);
        res.json(tasks);
      } else {
        const tasks = await storage.getFixedTasks();
        res.json(tasks);
      }
    } catch (error) {
      console.error("Failed to get fixed tasks:", error);
      res.status(500).json({ error: "Failed to get fixed tasks" });
    }
  });

  app.get("/api/fixed-tasks/by-key/:crewMemberId/:vesselId/:monthYear", async (req, res) => {
    try {
      const { crewMemberId, vesselId, monthYear } = req.params;
      const task = await storage.getFixedTaskByKey(crewMemberId, vesselId, monthYear);
      if (!task) {
        return res.status(404).json({ error: "Fixed task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Failed to get fixed task by key:", error);
      res.status(500).json({ error: "Failed to get fixed task by key" });
    }
  });

  app.get("/api/fixed-tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid task ID - must be a number" });
      }
      const task = await storage.getFixedTask(id);
      if (!task) {
        return res.status(404).json({ error: "Fixed task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Failed to get fixed task:", error);
      res.status(500).json({ error: "Failed to get fixed task" });
    }
  });

  app.post("/api/fixed-tasks", async (req, res) => {
    try {
      const result = insertFixedTaskSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid fixed task data", details: result.error.issues });
      }
      const task = await storage.createFixedTask(result.data);
      
      // Sync Fixed Tasks to RH Recording immediately after saving
      await syncFixedTasksToRHRecords(task.vesselId, task.monthYear);
      
      res.status(201).json(task);
    } catch (error) {
      console.error("Failed to create fixed task:", error);
      res.status(500).json({ error: "Failed to create fixed task" });
    }
  });

  app.put("/api/fixed-tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid task ID - must be a number" });
      }
      const result = insertFixedTaskSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid fixed task data", details: result.error.issues });
      }
      const task = await storage.updateFixedTask(id, result.data);
      if (!task) {
        return res.status(404).json({ error: "Fixed task not found" });
      }
      
      // Sync Fixed Tasks to RH Recording immediately after updating
      await syncFixedTasksToRHRecords(task.vesselId, task.monthYear);
      
      res.json(task);
    } catch (error) {
      console.error("Failed to update fixed task:", error);
      res.status(500).json({ error: "Failed to update fixed task" });
    }
  });

  app.delete("/api/fixed-tasks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid task ID - must be a number" });
      }
      
      // Get task first to extract vesselId, monthYear, and crewMemberId for sync
      const task = await storage.getFixedTask(id);
      if (!task) {
        return res.status(404).json({ error: "Fixed task not found" });
      }
      
      // Delete the task
      const deleted = await storage.deleteFixedTask(id);
      if (!deleted) {
        return res.status(404).json({ error: "Fixed task not found" });
      }
      
      // Clear all plan codes from RH Recording for this crew member
      // since their Fixed Task no longer exists
      await clearFixedTaskPlanCodes(task.crewMemberId, task.vesselId, task.monthYear);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete fixed task:", error);
      res.status(500).json({ error: "Failed to delete fixed task" });
    }
  });

  // Crew Members API routes
  app.get("/api/crew-members/next-crew-id", async (req, res) => {
    try {
      const nextCrewId = await storage.getNextCrewId();
      res.json({ crewId: nextCrewId });
    } catch (error) {
      console.error("❌ Failed to generate next crew ID:", error);
      res.status(500).json({ error: "Failed to generate next crew ID" });
    }
  });

  app.get("/api/crew-members/by-rank/:rank", async (req, res) => {
    try {
      const { rank } = req.params;
      const crewMembers = await storage.getCrewMembers();
      
      // Filter by rank and add experience data
      const filteredCrew = crewMembers
        .filter(crew => crew.presentRank === rank)
        .map(crew => {
          // Calculate experience metrics from sea service data
          // For now, using placeholder data - will be enhanced with real calculations
          const experience = {
            company: Math.floor(Math.random() * 10) + 1, // 1-10 years
            rank: Math.floor(Math.random() * 8) + 1, // 1-8 years
            tankers: Math.floor(Math.random() * 6) + 1, // 1-6 years
            oow: Math.floor(Math.random() * 12) + 1, // 1-12 years
            endorsements: ['OGC', 'IGC', 'STW'][Math.floor(Math.random() * 3)] || 'OGC'
          };
          
          // Extract pool from status or use placeholder
          const pools = ['Pool A', 'Pool B', 'Pool C'];
          const pool = pools[Math.floor(Math.random() * pools.length)];
          
          // Get ship type from vesselType or vesselTypes array
          const shipType = crew.vesselType || (crew.vesselTypes && crew.vesselTypes.length > 0 ? crew.vesselTypes[0] : undefined);
          
          // Placeholder data for travel status, higher cert, and performance
          const travelStatuses = ['Available', 'On Leave', 'Traveling'];
          const travelStatus = travelStatuses[Math.floor(Math.random() * travelStatuses.length)];
          
          const higherCerts = ['Master Unlimited', 'Chief Engineer Unlimited', 'None'];
          const higherCert = higherCerts[Math.floor(Math.random() * higherCerts.length)];
          
          const performances = ['Excellent', 'Good', 'Average'];
          const performance = performances[Math.floor(Math.random() * performances.length)];
          
          return {
            id: crew.id,
            name: `${crew.firstName} ${crew.middleName || ''} ${crew.familyName || ''}`.trim(),
            rank: crew.presentRank,
            pool,
            manningAgent: crew.manningAgent,
            shipType,
            nationality: crew.nationality,
            travelStatus,
            higherCert,
            performance,
            experience
          };
        });
      
      res.json(filteredCrew);
    } catch (error) {
      console.error("Failed to fetch crew by rank:", error);
      res.status(500).json({ error: "Failed to fetch crew members by rank" });
    }
  });

  /**
   * AUTOMATIC SYNCHRONIZATION HELPERS
   * These ensure crew members automatically appear in Planning, Officer Matrix, and Training Matrix
   */
  
  /**
   * Auto-create vessel planning entry when crew has vessel + rank assigned
   */
  async function autoCreateVesselPlanning(crewMember: any) {
    try {
      // Only create if crew has both vessel and rank
      if (!crewMember.presentVessel || !crewMember.presentRank) {
        console.log(`⚡ [AUTO-SYNC] Skipping vessel planning for ${crewMember.id}: no vessel or rank assigned`);
        return null;
      }

      const crewId = crewMember.id || crewMember.employeeId;
      
      // Check if planning entry already exists for this crew member
      const allPlanning = await storage.getVesselPlanningByVessel(crewMember.presentVessel);
      const existingEntry = allPlanning.find((p: any) => p.crewMemberId === crewId);
      
      if (existingEntry) {
        console.log(`⚡ [AUTO-SYNC] Vessel planning already exists for ${crewId}`);
        
        // 🔄 UPDATE CREW MEMBER'S RANK TO MATCH EXISTING PLANNING POSITION
        const assignedPosition = existingEntry.rank;
        const crewRank = crewMember.presentRank;
        if (assignedPosition && assignedPosition !== crewRank) {
          await storage.updateCrewMember(crewId, { 
            presentRank: assignedPosition 
          });
          console.log(`✅ [AUTO-SYNC] Updated crew ${crewId} rank: ${crewRank} → ${assignedPosition}`);
        }
        
        return existingEntry;
      }

      // Get vessel revisions to find the correct rank ID
      const vesselRevisions = await storage.getVesselRevisionsByVessel(crewMember.presentVessel);
      
      if (vesselRevisions.length === 0) {
        console.log(`⚡ [AUTO-SYNC] No vessel revisions found for ${crewMember.presentVessel}`);
        return null;
      }

      // Get latest revision
      const latestRevision = vesselRevisions.sort((a, b) => {
        const aDate = new Date(a.createdAt || 0).getTime();
        const bDate = new Date(b.createdAt || 0).getTime();
        return bDate - aDate;
      })[0];

      const rankData = JSON.parse(latestRevision.revisionData);
      
      // Find matching rank in vessel revision
      // Match by exact role/rank name or by stripping suffix (e.g., "3rd Officer_1" -> "3rd Officer")
      const crewRank = crewMember.presentRank;
      
      // Find ALL matching ranks (handles positions with numeric suffixes like AB_1, AB_2, AB_3)
      const matchingRanks = rankData.filter((r: any) => {
        const rankName = (r.role || r.rank)?.split('_')[0];
        return (r.role === crewRank || r.rank === crewRank || rankName === crewRank);
      });
      
      // 🔧 PRIORITIZE NUMBERED POSITIONS: If both base rank and numbered positions exist,
      // only use numbered positions (rows with 'role' field like AB_1, AB_2, AB_3)
      // Filter to rows that have a role value (excludes base rank rows where role is null)
      const rolePositions = matchingRanks.filter((r: any) => r.role !== null && r.role !== undefined);
      const finalMatchingRanks = rolePositions.length > 0 ? rolePositions : matchingRanks;
      
      console.log(`⚡ [AUTO-SYNC] Matching ranks for ${crewRank}: ${matchingRanks.length}, Role positions: ${rolePositions.length}`);

      if (finalMatchingRanks.length === 0) {
        console.log(`⚡ [AUTO-SYNC] Rank ${crewRank} not found in vessel ${crewMember.presentVessel} revision`);
        return null;
      }

      // If multiple positions exist (e.g., AB_1, AB_2, AB_3), find the first VACANT one
      let matchingRank = null;
      if (finalMatchingRanks.length > 1) {
        // Get existing planning to check which positions are occupied
        for (const rank of finalMatchingRanks) {
          const rankId = rank.id || rank.rankId;
          const isOccupied = allPlanning.some((p: any) => 
            p.rankId === rankId && p.crewMemberId && p.crewMemberId !== crewId
          );
          if (!isOccupied) {
            matchingRank = rank;
            console.log(`⚡ [AUTO-SYNC] Found vacant position: ${rank.role || rank.rank} for ${crewRank}`);
            break;
          }
        }
        
        if (!matchingRank) {
          console.log(`⚡ [AUTO-SYNC] All ${crewRank} positions are occupied on vessel ${crewMember.presentVessel}`);
          return null;
        }
      } else {
        // Only one position, use it
        matchingRank = finalMatchingRanks[0];
      }

      // Create vessel planning entry
      const assignedPosition = matchingRank.role || matchingRank.rank;
      const planningData = {
        vesselId: crewMember.presentVessel,
        rankId: matchingRank.id || matchingRank.rankId,
        rank: assignedPosition,
        crewMemberId: crewId,
        reliefDue: crewMember.reliefDue || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const created = await storage.createVesselPlanning(planningData);
      
      // 🔄 UPDATE CREW MEMBER'S RANK TO MATCH ASSIGNED POSITION
      // This ensures Crew List shows the same position as Planning/Officer Matrix
      if (assignedPosition !== crewRank) {
        await storage.updateCrewMember(crewId, { 
          presentRank: assignedPosition 
        });
        console.log(`✅ [AUTO-SYNC] Updated crew ${crewId} rank: ${crewRank} → ${assignedPosition}`);
      }
      
      console.log(`✅ [AUTO-SYNC] Created vessel planning entry for ${crewId}: ${assignedPosition} on ${crewMember.presentVessel}`);
      return created;
    } catch (error) {
      console.error(`❌ [AUTO-SYNC] Failed to auto-create vessel planning:`, error);
      return null;
    }
  }

  /**
   * Update or create vessel planning when crew's vessel/rank changes
   */
  async function syncVesselPlanning(crewId: string, updates: any, oldCrew: any) {
    try {
      const vesselChanged = updates.presentVessel && updates.presentVessel !== oldCrew.presentVessel;
      const rankChanged = updates.presentRank && updates.presentRank !== oldCrew.presentRank;
      const reliefDueChanged = updates.reliefDue !== undefined && updates.reliefDue !== oldCrew.reliefDue;
      
      if (!vesselChanged && !rankChanged && !reliefDueChanged) {
        return; // No vessel/rank/relief due changes, skip sync
      }

      const newVessel = updates.presentVessel || oldCrew.presentVessel;
      const newRank = updates.presentRank || oldCrew.presentRank;

      console.log(`⚡ [AUTO-SYNC] Syncing vessel planning for ${crewId}: vessel=${newVessel}, rank=${newRank}`);

      // Find existing planning entry for this crew member
      const allPlanning = await storage.getVesselPlanningByVessel(newVessel);
      const existingEntry = allPlanning.find((p: any) => p.crewMemberId === crewId);

      if (!newVessel || !newRank) {
        // Crew unassigned - could delete planning entry, but we'll keep it for history
        console.log(`⚡ [AUTO-SYNC] Crew ${crewId} unassigned from vessel/rank`);
        return;
      }

      // Get the updated crew member data
      const updatedCrew = { ...oldCrew, ...updates };

      if (existingEntry) {
        // Update existing entry if vessel, rank, or relief due changed
        const updateData: any = {};
        
        if (vesselChanged) {
          updateData.vesselId = newVessel;
        }
        
        if (rankChanged) {
          // Need to find new rank ID from vessel revision
          const vesselRevisions = await storage.getVesselRevisionsByVessel(newVessel);
          if (vesselRevisions.length > 0) {
            const latestRevision = vesselRevisions.sort((a, b) => {
              const aDate = new Date(a.createdAt || 0).getTime();
              const bDate = new Date(b.createdAt || 0).getTime();
              return bDate - aDate;
            })[0];

            const rankData = JSON.parse(latestRevision.revisionData);
            
            // Find ALL matching positions to handle multiple ranks (AB_1, AB_2, etc.)
            const matchingRanks = rankData.filter((r: any) => {
              const rankName = (r.role || r.rank)?.split('_')[0];
              return (r.role === newRank || r.rank === newRank || rankName === newRank);
            });

            if (matchingRanks.length > 0) {
              let matchingRank = matchingRanks[0]; // Default to first match
              
              // If multiple positions exist, try to keep the same position or find vacant one
              if (matchingRanks.length > 1) {
                // First, try to find the exact position match (crew already has AB_1, keep it)
                const exactMatch = matchingRanks.find((r: any) => 
                  (r.role === newRank || r.rank === newRank)
                );
                if (exactMatch) {
                  matchingRank = exactMatch;
                } else {
                  // Find first vacant position
                  for (const rank of matchingRanks) {
                    const rankId = rank.id || rank.rankId;
                    const isOccupied = allPlanning.some((p: any) => 
                      p.rankId === rankId && p.crewMemberId && p.crewMemberId !== crewId
                    );
                    if (!isOccupied) {
                      matchingRank = rank;
                      break;
                    }
                  }
                }
              }
              
              const assignedPosition = matchingRank.role || matchingRank.rank;
              updateData.rankId = matchingRank.id || matchingRank.rankId;
              updateData.rank = assignedPosition;
              
              // 🔄 UPDATE CREW MEMBER'S RANK TO MATCH ASSIGNED POSITION
              if (assignedPosition !== newRank) {
                await storage.updateCrewMember(crewId, { 
                  presentRank: assignedPosition 
                });
                console.log(`✅ [AUTO-SYNC] Updated crew ${crewId} rank: ${newRank} → ${assignedPosition}`);
              }
            }
          }
        }

        // 🔄 Sync Relief Due date if changed
        if (updates.reliefDue !== undefined && updates.reliefDue !== oldCrew.reliefDue) {
          updateData.reliefDue = updates.reliefDue;
          console.log(`⚡ [AUTO-SYNC] Relief Due updated: ${oldCrew.reliefDue} → ${updates.reliefDue}`);
        }

        if (Object.keys(updateData).length > 0) {
          updateData.updatedAt = new Date().toISOString();
          await storage.updateVesselPlanning(existingEntry.id, updateData);
          console.log(`✅ [AUTO-SYNC] Updated vessel planning for ${crewId}`);
        }
      } else {
        // No existing entry - create new one
        await autoCreateVesselPlanning(updatedCrew);
      }
    } catch (error) {
      console.error(`❌ [AUTO-SYNC] Failed to sync vessel planning:`, error);
    }
  }

  app.get("/api/crew-members", async (req, res) => {
    try {
      // Parse query parameters for filtering
      const filters: {
        rank?: string;
        nationality?: string;
        status?: string;
        search?: string;
      } = {};
      
      if (req.query.rank) filters.rank = req.query.rank as string;
      if (req.query.nationality) filters.nationality = req.query.nationality as string;
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.search) filters.search = req.query.search as string;
      
      const crewMembers = await storage.getCrewMembers(Object.keys(filters).length > 0 ? filters : undefined);
      // Normalize crew members for table/frontend consumption
      const normalizedCrewMembers = crewMembers.map(normalizeCrewMemberForTable);
      res.json(normalizedCrewMembers);
    } catch (error) {
      console.error("❌ Failed to fetch crew members with filters:", error);
      res.status(500).json({ error: "Failed to fetch crew members" });
    }
  });

  app.get("/api/crew-members/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const crewMember = await storage.getCrewMember(id);
      if (!crewMember) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      // Use same normalization as list endpoint for consistency
      const normalizedCrewMember = normalizeCrewMemberForTable(crewMember);
      res.json(normalizedCrewMember);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch crew member" });
    }
  });

  app.post("/api/crew-members", async (req, res) => {
    try {
      // Check if this is form data from CrewInfoForm (comprehensive)
      // or simple crew member data (basic fields only)
      let mappedData;
      if (req.body.documents || req.body.education || req.body.licenses || req.body.currentCompanySeaService) {
        // This is comprehensive form data - use form mapping
        mappedData = mapFormDataToStorage(req.body);
      } else {
        // This is basic crew member data - use direct storage mapping
        mappedData = toStorageCrew(req.body);
      }
      
      // Auto-assign crew ID if not provided (backwards compatibility)
      if (!mappedData.employeeId) {
        mappedData.employeeId = await storage.getNextCrewId();
      }
      
      // Ensure id field is set for database (required as primary key)
      if (!mappedData.id) {
        mappedData.id = mappedData.employeeId || await storage.getNextCrewId();
      }
      
      const result = insertCrewMemberSchema.safeParse(mappedData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid crew member data", details: result.error.issues });
      }
      const crewMember = await storage.createCrewMember(result.data);
      
      // 🔄 AUTOMATIC SYNCHRONIZATION: Create vessel planning entry if crew has vessel + rank
      await autoCreateVesselPlanning(crewMember);
      
      // Return normalized data to frontend
      const normalizedCrewMember = fromStorageCrew(crewMember);
      res.status(201).json(normalizedCrewMember);
    } catch (error) {
      res.status(500).json({ error: "Failed to create crew member" });
    }
  });

  app.put("/api/crew-members/:id", async (req, res) => {
    try {
      const id = req.params.id;
      
      // Get old crew data before update for sync comparison
      const oldCrew = await storage.getCrewMember(id);
      if (!oldCrew) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      
      // Check if this is form data from CrewInfoForm (comprehensive)
      // or simple crew member data (basic fields only)
      let mappedData;
      if (req.body.documents || req.body.education || req.body.licenses || req.body.currentCompanySeaService) {
        // This is comprehensive form data - use form mapping
        mappedData = mapFormDataToStorage(req.body);
      } else {
        // This is basic crew member data - use direct storage mapping
        mappedData = toStorageCrew(req.body);
      }
      
      const result = insertCrewMemberSchema.partial().safeParse(mappedData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid crew member data", details: result.error.issues });
      }
      const crewMember = await storage.updateCrewMember(id, result.data);
      if (!crewMember) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      
      // 🔄 AUTOMATIC SYNCHRONIZATION: Sync vessel planning if vessel/rank changed
      const crewId = crewMember.id || crewMember.employeeId;
      if (crewId) {
        await syncVesselPlanning(crewId, result.data, oldCrew);
      }
      
      // Return normalized data to frontend
      const normalizedCrewMember = fromStorageCrew(crewMember);
      res.json(normalizedCrewMember);
    } catch (error) {
      res.status(500).json({ error: "Failed to update crew member" });
    }
  });

  // PATCH route for partial updates (used by CrewInfoForm)
  app.patch("/api/crew-members/:id", async (req, res) => {
    try {
      const id = req.params.id;
      
      // Get old crew data before update for sync comparison
      const oldCrew = await storage.getCrewMember(id);
      if (!oldCrew) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      
      // Check if this is form data from CrewInfoForm (comprehensive)
      // or simple crew member data (basic fields only)
      let mappedData;
      if (req.body.documents || req.body.education || req.body.licenses || req.body.currentCompanySeaService) {
        // This is comprehensive form data - use form mapping
        mappedData = mapFormDataToStorage(req.body);
      } else {
        // This is basic crew member data - use direct storage mapping
        mappedData = toStorageCrew(req.body);
      }
      
      const result = insertCrewMemberSchema.partial().safeParse(mappedData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid crew member data", details: result.error.issues });
      }
      const crewMember = await storage.updateCrewMember(id, result.data);
      if (!crewMember) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      
      // 🔄 AUTOMATIC SYNCHRONIZATION: Sync vessel planning if vessel/rank changed
      const crewId = crewMember.id || crewMember.employeeId;
      if (crewId) {
        await syncVesselPlanning(crewId, result.data, oldCrew);
      }
      
      // Return normalized data to frontend
      const normalizedCrewMember = fromStorageCrew(crewMember);
      res.json(normalizedCrewMember);
    } catch (error) {
      res.status(500).json({ error: "Failed to update crew member" });
    }
  });

  app.delete("/api/crew-members/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const deleted = await storage.deleteCrewMember(id);
      if (!deleted) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete crew member" });
    }
  });

  // Migration/Re-sync endpoint: Create missing vessel planning entries for existing crew
  app.post("/api/crew-members/resync-planning", async (req, res) => {
    try {
      const crewMembers = await storage.getCrewMembers();
      let created = 0;
      let skipped = 0;
      let errors = 0;
      
      for (const crew of crewMembers) {
        const crewId = crew.id || crew.employeeId;
        if (!crewId || !crew.presentVessel || !crew.presentRank) {
          skipped++;
          continue;
        }
        
        try {
          const result = await autoCreateVesselPlanning(crew);
          if (result) {
            created++;
            console.log(`✅ [RE-SYNC] Created planning for ${crewId}: ${crew.presentRank} on ${crew.presentVessel}`);
          } else {
            skipped++;
          }
        } catch (error) {
          errors++;
          console.error(`❌ [RE-SYNC] Failed for ${crewId}:`, error);
        }
      }
      
      res.json({ 
        success: true, 
        total: crewMembers.length,
        created, 
        skipped, 
        errors,
        message: `Re-sync completed: ${created} planning entries created, ${skipped} skipped, ${errors} errors`
      });
    } catch (error) {
      console.error("Re-sync failed:", error);
      res.status(500).json({ error: "Failed to re-sync vessel planning" });
    }
  });

  // Rotation module - Due crew endpoint
  app.get("/api/rotation/due-crew", async (req, res) => {
    try {
      const { filterType, vessels, fleet, addGroup, dueIn, rank } = req.query;
      
      // Fetch vessel master data for code-to-name translation
      // Uses canonical vessel codes (VSL-XXX) as keys after recent vessel code enforcement
      const vesselMasterData = await storage.getMasterDataEntries("014");
      const vesselCodeToNameMap = new Map<string, string>();
      if (vesselMasterData) {
        vesselMasterData.forEach((vessel: any) => {
          // Use entry_id (canonical vessel code) as the key for translation
          // Master data stores VSL-XXX codes in entry_id field (snake_case from database)
          if (vessel.entry_id && vessel.name) {
            vesselCodeToNameMap.set(vessel.entry_id, vessel.name);
          }
        });
      }
      // Fetch all crew members and vessel planning data
      const crewMembers = await storage.getCrewMembers();
      
      // Get all vessel planning data (we'll need to join this)
      const allPlanningPromises = crewMembers.map(async (crew) => {
        if (!crew.presentVessel) return null;
        try {
          const planning = await storage.getVesselPlanningByVessel(crew.presentVessel);
          return planning;
        } catch {
          return [];
        }
      });
      const allPlanning = await Promise.all(allPlanningPromises);
      const planningMap = new Map<string, any[]>();
      allPlanning.forEach((planning, idx) => {
        if (planning && crewMembers[idx]) {
          const vessel = crewMembers[idx].presentVessel;
          if (vessel) {
            planningMap.set(vessel, planning);
          }
        }
      });

      // Process crew members with contract date calculations
      const processedCrew = crewMembers
        .filter(crew => crew.presentRank && crew.presentVessel)
        .map(crew => {
          const vesselPlanning = planningMap.get(crew.presentVessel || '') || [];
          
          // Find matching planning data by rank (including crew member match)
          const matchingPlan = vesselPlanning.find(p => 
            p.rank === crew.presentRank && p.crewMemberId === crew.id
          );
          
          // Get dates from vesselPlanning if available, otherwise from crew record
          const rawJoiningDate = matchingPlan?.joiningDate || crew.joiningDate;
          const rawReliefDue = matchingPlan?.reliefDueDate || crew.reliefDue;
          
          // Calculate range dates with defaults (1 month if no planning data)
          const rangeEndMonths = matchingPlan?.contractEndRangeEndMonths ?? 1;
          const rangeStartMonths = matchingPlan?.contractEndRangeStartMonths ?? 0;
          
          // Parse dates using centralized utility (handles all formats)
          const joiningDate = parseFlexibleDate(rawJoiningDate || '');
          const reliefDue = parseFlexibleDate(rawReliefDue || '');
          
          // Only include crew with valid relief due date
          if (!reliefDue) return null;

          // Calculate range dates
          const rangeStartDate = new Date(reliefDue);
          rangeStartDate.setMonth(rangeStartDate.getMonth() + rangeStartMonths);
          
          const rangeEndDate = new Date(reliefDue);
          rangeEndDate.setMonth(rangeEndDate.getMonth() + rangeEndMonths);

          return {
            id: crew.id,
            vesselId: crew.presentVessel, // Keep vessel code for filtering
            vessel: vesselCodeToNameMap.get(crew.presentVessel || '') || crew.presentVessel, // Translate code to name for display
            rank: crew.presentRank,
            name: `${crew.firstName} ${crew.middleName || ''} ${crew.familyName || ''}`.trim(),
            reliefDue: rawReliefDue,
            contractStartDate: rawJoiningDate,
            contractEndDate: rawReliefDue,
            rangeStartDate: rangeStartDate.toISOString().split('T')[0],
            rangeEndDate: rangeEndDate.toISOString().split('T')[0],
            nationality: crew.nationality,
            // Include raw dates for filtering
            _reliefDueDate: reliefDue,
            _rangeEndDate: rangeEndDate,
          };
        })
        .filter((crew): crew is NonNullable<typeof crew> => crew !== null);

      // Apply filters
      let filteredCrew = processedCrew;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Apply vessel/fleet/addGroup filter
      if (filterType === 'vessel' && vessels) {
        const vesselList = Array.isArray(vessels) ? vessels : [vessels];
        filteredCrew = filteredCrew.filter(crew => vesselList.includes(crew.vesselId));
      } else if (filterType === 'fleet' && fleet) {
        // TODO: Implement fleet filtering when fleet master data is available
      } else if (filterType === 'addGroup' && addGroup) {
        // TODO: Implement additional group filtering when group master data is available
      }

      // Apply rank filter (handle both single rank and multiple ranks)
      if (rank) {
        const rankList = Array.isArray(rank) 
          ? rank.filter(r => typeof r === 'string' && r.trim())
          : typeof rank === 'string' ? [rank] : [];
        if (rankList.length > 0) {
          // Build a set of base ranks from role variants (normalize "_1", "_2" suffixes)
          const baseRanksFromVariants = new Set<string>();
          rankList.forEach(r => {
            if (typeof r === 'string' && r.includes('_')) {
              const baseRank = r.substring(0, r.lastIndexOf('_'));
              baseRanksFromVariants.add(baseRank);
            }
          });
          
          filteredCrew = filteredCrew.filter(crew => {
            // Direct match (crew rank exactly in query list)
            if (rankList.includes(crew.rank)) return true;
            // Base rank match (crew rank is the base of a queried variant)
            if (baseRanksFromVariants.has(crew.rank)) return true;
            return false;
          });
        }
      }

      // Apply dueIn filter
      if (dueIn) {
        const monthsMap: Record<string, number> = {
          '3m': 3,
          '2m': 2,
          '1m': 1,
        };

        if (dueIn === 'overdue') {
          // Range End Date is before today
          filteredCrew = filteredCrew.filter(crew => crew._rangeEndDate < today);
        } else if (dueIn === 'overdue1m') {
          // Range End Date is within next month and >= today
          const oneMonthFromNow = new Date(today);
          oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
          filteredCrew = filteredCrew.filter(crew => 
            crew._rangeEndDate >= today && crew._rangeEndDate <= oneMonthFromNow
          );
        } else if (monthsMap[dueIn as string]) {
          // Relief Due is within X months from today
          const months = monthsMap[dueIn as string];
          const targetDate = new Date(today);
          targetDate.setMonth(targetDate.getMonth() + months);
          filteredCrew = filteredCrew.filter(crew => 
            crew._reliefDueDate >= today && crew._reliefDueDate <= targetDate
          );
        }
      }

      // Remove temporary fields before sending
      const cleanedCrew = filteredCrew.map(crew => {
        const { _reliefDueDate, _rangeEndDate, ...cleanCrew } = crew as any;
        return cleanCrew;
      });

      res.json(cleanedCrew);
    } catch (error) {
      console.error("Failed to fetch rotation due crew:", error);
      res.status(500).json({ error: "Failed to fetch rotation due crew" });
    }
  });

  // Assign crew IDs to existing crew members who don't have them
  app.post("/api/crew-members/assign-ids", async (req, res) => {
    try {
      const crewMembers = await storage.getCrewMembers();
      const crewMembersWithoutIds = crewMembers.filter(cm => !cm.employeeId);
      
      if (crewMembersWithoutIds.length === 0) {
        return res.json({ 
          message: "All crew members already have IDs", 
          totalCrew: crewMembers.length 
        });
      }

      let updatedCount = 0;
      for (const crewMember of crewMembersWithoutIds) {
        const crewId = await storage.getNextCrewId();
        const updated = await storage.updateCrewMember(crewMember.id, { employeeId: crewId });
        if (updated) {
          updatedCount++;
          console.log(`✅ Assigned crew ID ${crewId} to ${crewMember.firstName} ${crewMember.familyName || 'Unknown'}`);
        }
      }

      res.json({ 
        message: "Crew ID assignment completed", 
        updatedCount,
        totalWithoutIds: crewMembersWithoutIds.length 
      });
    } catch (error) {
      console.error("Error assigning crew IDs:", error);
      res.status(500).json({ error: "Failed to assign crew IDs" });
    }
  });

  // Dashboard Summary endpoint
  app.get("/api/crew-members/:id/dashboard", async (req, res) => {
    try {
      const id = req.params.id;
      const dashboardSummary = await storage.getCrewDashboardSummary(id);
      if (!dashboardSummary) {
        return res.status(404).json({ error: "Crew member not found" });
      }
      res.json(dashboardSummary);
    } catch (error) {
      console.error("Error fetching dashboard summary:", error);
      res.status(500).json({ error: "Failed to fetch dashboard summary" });
    }
  });

  // Retroactive crew ID assignment endpoint
  app.post("/api/crew-members/assign-missing-ids", async (req, res) => {
    try {
      console.log("🔄 Starting retroactive crew ID assignment...");
      
      // Get all crew members
      const allCrewMembers = await storage.getCrewMembers();
      
      // Find crew members without crew IDs (employeeId is null or empty)
      const crewMembersNeedingIds = allCrewMembers.filter(member => 
        !member.employeeId || member.employeeId === null || member.employeeId === ''
      );
      
      console.log(`📊 Found ${crewMembersNeedingIds.length} crew members needing crew IDs`);
      
      if (crewMembersNeedingIds.length === 0) {
        return res.json({ 
          success: true, 
          message: "No crew members need crew ID assignment",
          assigned: []
        });
      }
      
      const assignments = [];
      
      // Assign crew IDs to each crew member needing one
      for (const crewMember of crewMembersNeedingIds) {
        try {
          // Get next crew ID
          const newCrewId = await storage.getNextCrewId();
          
          // Update the crew member with the new ID
          await storage.updateCrewMember(crewMember.id, { employeeId: newCrewId });
          
          assignments.push({
            id: crewMember.id,
            name: `${crewMember.firstName} ${crewMember.familyName}`,
            assignedId: newCrewId
          });
          
          console.log(`✅ Assigned ${newCrewId} to ${crewMember.firstName} ${crewMember.familyName}`);
        } catch (error) {
          console.error(`❌ Failed to assign crew ID to ${crewMember.firstName} ${crewMember.familyName}:`, error);
        }
      }
      
      console.log(`🎉 Successfully assigned crew IDs to ${assignments.length} crew members`);
      
      res.json({ 
        success: true,
        message: `Successfully assigned crew IDs to ${assignments.length} crew members`,
        assigned: assignments
      });
      
    } catch (error) {
      console.error("❌ Failed to assign missing crew IDs:", error);
      res.status(500).json({ error: "Failed to assign missing crew IDs" });
    }
  });

  // Appraisal Results API routes
  app.get("/api/appraisals", async (req, res) => {
    try {
      const appraisals = await storage.getAppraisalResults();
      res.json(appraisals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch appraisals" });
    }
  });

  app.get("/api/appraisals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const appraisal = await storage.getAppraisalResult(id);
      if (!appraisal) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json(appraisal);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch appraisal" });
    }
  });

  app.get("/api/appraisals/crew/:crewMemberId", async (req, res) => {
    try {
      const crewMemberId = req.params.crewMemberId;
      const appraisals = await storage.getAppraisalResultsByCrewMember(crewMemberId);
      res.json(appraisals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch appraisals for crew member" });
    }
  });

  app.post("/api/appraisals", async (req, res) => {
    try {
      const result = insertAppraisalResultSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid appraisal data", details: result.error.issues });
      }
      const appraisal = await storage.createAppraisalResult(result.data);
      res.status(201).json(appraisal);
    } catch (error) {
      res.status(500).json({ error: "Failed to create appraisal" });
    }
  });

  app.put("/api/appraisals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertAppraisalResultSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid appraisal data", details: result.error.issues });
      }
      const appraisal = await storage.updateAppraisalResult(id, result.data);
      if (!appraisal) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json(appraisal);
    } catch (error) {
      res.status(500).json({ error: "Failed to update appraisal" });
    }
  });

  app.delete("/api/appraisals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteAppraisalResult(id);
      if (!deleted) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete appraisal" });
    }
  });

  // Stage-specific submission endpoints
  app.post("/api/appraisals/:id/submit-stage1", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Validate request body
      const validationResult = stage1SubmissionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid stage 1 data", 
          details: validationResult.error.issues 
        });
      }

      const { data, submittedBy } = validationResult.data;
      
      const appraisal = await storage.submitAppraisalStage(id, 'stage1', data, submittedBy || 'Unknown');
      if (!appraisal) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json(appraisal);
    } catch (error: any) {
      console.error('Stage 1 submission error:', error);
      res.status(500).json({ error: error.message || "Failed to submit stage 1" });
    }
  });

  app.post("/api/appraisals/:id/submit-stage2", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Validate request body
      const validationResult = stage2SubmissionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid stage 2 data", 
          details: validationResult.error.issues 
        });
      }

      const { data, submittedBy } = validationResult.data;
      
      const appraisal = await storage.submitAppraisalStage(id, 'stage2', data, submittedBy || 'Unknown');
      if (!appraisal) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json(appraisal);
    } catch (error: any) {
      console.error('Stage 2 submission error:', error);
      res.status(500).json({ error: error.message || "Failed to submit stage 2" });
    }
  });

  app.post("/api/appraisals/:id/submit-stage3", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Validate request body
      const validationResult = stage3SubmissionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid stage 3 data", 
          details: validationResult.error.issues 
        });
      }

      const { data, submittedBy } = validationResult.data;
      
      const appraisal = await storage.submitAppraisalStage(id, 'stage3', data, submittedBy || 'Unknown');
      if (!appraisal) {
        return res.status(404).json({ error: "Appraisal not found" });
      }
      res.json(appraisal);
    } catch (error: any) {
      console.error('Stage 3 submission error:', error);
      res.status(500).json({ error: error.message || "Failed to submit stage 3" });
    }
  });

  // Recruitment Candidates API routes
  app.get("/api/recruitment-candidates", async (req, res) => {
    try {
      const { status } = req.query;
      let candidates;
      
      if (status && typeof status === 'string') {
        candidates = await storage.getRecruitmentCandidatesByStatus(status);
      } else {
        candidates = await storage.getRecruitmentCandidates();
      }
      
      res.json(candidates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recruitment candidates" });
    }
  });

  app.get("/api/recruitment-candidates/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const candidate = await storage.getRecruitmentCandidate(id);
      if (!candidate) {
        return res.status(404).json({ error: "Recruitment candidate not found" });
      }
      res.json(candidate);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recruitment candidate" });
    }
  });

  app.post("/api/recruitment-candidates", async (req, res) => {
    try {
      const result = insertRecruitmentCandidateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid recruitment candidate data", details: result.error.issues });
      }
      const candidate = await storage.createRecruitmentCandidate(result.data);
      res.status(201).json(candidate);
    } catch (error: any) {
      // Check for PostgreSQL UNIQUE constraint violation (error code 23505)
      if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
        return res.status(400).json({ 
          error: "Duplicate data", 
          message: "A recruitment candidate with this fileNo already exists" 
        });
      }
      console.error('Error creating recruitment candidate:', error);
      res.status(500).json({ error: "Failed to create recruitment candidate" });
    }
  });

  app.patch("/api/recruitment-candidates/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const result = insertRecruitmentCandidateSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid recruitment candidate data", details: result.error.issues });
      }
      const candidate = await storage.updateRecruitmentCandidate(id, result.data);
      if (!candidate) {
        return res.status(404).json({ error: "Recruitment candidate not found" });
      }
      res.json(candidate);
    } catch (error) {
      res.status(500).json({ error: "Failed to update recruitment candidate" });
    }
  });

  app.patch("/api/recruitment-candidates/:id/soft-delete", async (req, res) => {
    try {
      const id = req.params.id;
      console.log(`Soft deleting recruitment candidate: ${id}`);
      
      const candidate = await storage.softDeleteRecruitmentCandidate(id);
      if (!candidate) {
        return res.status(404).json({ 
          error: "Candidate not found",
          message: `Recruitment candidate with ID ${id} does not exist`
        });
      }
      
      console.log(`Successfully soft deleted candidate: ${id}`);
      
      res.json({ 
        success: true,
        message: "Recruitment candidate deleted successfully",
        id: id
      });
    } catch (error: any) {
      console.error('Error soft deleting recruitment candidate:', error);
      res.status(500).json({ 
        error: "Failed to delete recruitment candidate",
        message: error.message 
      });
    }
  });

  // DEPRECATED: Hard delete disabled in favor of soft delete
  // Use PATCH /api/recruitment-candidates/:id/soft-delete instead
  /*
  app.delete("/api/recruitment-candidates/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const deleted = await storage.deleteRecruitmentCandidate(id);
      if (!deleted) {
        return res.status(404).json({ error: "Recruitment candidate not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete recruitment candidate" });
    }
  });
  */

  app.post("/api/recruitment-candidates/:id/transfer-to-crew", async (req, res) => {
    try {
      const id = req.params.id;
      const result = await storage.transferRecruitedCandidate(id);
      res.status(201).json(result);
    } catch (error: any) {
      console.error('Transfer error:', error);
      res.status(400).json({ error: error.message || "Failed to transfer candidate to crew database" });
    }
  });

  // Data Masters API routes
  app.get("/api/masters", async (req, res) => {
    try {
      const masters = await storage.getDataMasters();
      res.json(masters);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch masters" });
    }
  });

  app.get("/api/masters/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const master = await storage.getDataMaster(id);
      if (!master) {
        return res.status(404).json({ error: "Master not found" });
      }
      res.json(master);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch master" });
    }
  });

  app.post("/api/masters", async (req, res) => {
    try {
      const result = insertDataMasterSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid master data", details: result.error.issues });
      }
      const master = await storage.createDataMaster(result.data);
      res.status(201).json(master);
    } catch (error) {
      res.status(500).json({ error: "Failed to create master" });
    }
  });

  app.put("/api/masters/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const result = insertDataMasterSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid master data", details: result.error.issues });
      }
      const master = await storage.updateDataMaster(id, result.data);
      if (!master) {
        return res.status(404).json({ error: "Master not found" });
      }
      res.json(master);
    } catch (error) {
      res.status(500).json({ error: "Failed to update master" });
    }
  });

  app.delete("/api/masters/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const deleted = await storage.deleteDataMaster(id);
      if (!deleted) {
        return res.status(404).json({ error: "Master not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete master" });
    }
  });

  // Nationalities endpoint - wrapper for /api/masters/001/data
  app.get("/api/nationalities", async (req, res) => {
    try {
      const entries = await storage.getMasterDataEntries('001');
      // Extract nationality names from master data entries
      // Handle both 'nationality' and 'name' fields for flexibility
      const nationalities = entries.map((entry: any) => 
        entry.nationality || entry.name || ''
      ).filter((n: string) => n.length > 0);
      
      res.json(nationalities);
    } catch (error) {
      console.error("❌ Failed to fetch nationalities:", error);
      res.status(500).json({ error: "Failed to fetch nationalities" });
    }
  });

  // Vessels endpoints - wrapper for /api/masters/014/data
  app.get("/api/vessels", async (req, res) => {
    try {
      const entries = await storage.getMasterDataEntries('014');
      
      // Apply filters from query parameters
      let filteredEntries = entries;
      
      // Filter by name/vessel
      if (req.query.name) {
        const searchName = (req.query.name as string).toLowerCase();
        filteredEntries = filteredEntries.filter((entry: any) => {
          const vesselName = (entry.vessel || entry.name || '').toLowerCase();
          return vesselName.includes(searchName);
        });
      }
      
      // Filter by vessel type
      if (req.query.vesselType) {
        const searchType = (req.query.vesselType as string).toLowerCase();
        filteredEntries = filteredEntries.filter((entry: any) => 
          (entry.vesselType || '').toLowerCase().includes(searchType)
        );
      }
      
      // Filter by active status
      if (req.query.isActive !== undefined) {
        const isActive = req.query.isActive === 'true';
        filteredEntries = filteredEntries.filter((entry: any) => 
          entry.isActive === isActive
        );
      }
      
      res.json(filteredEntries);
    } catch (error) {
      console.error("❌ Failed to fetch vessels:", error);
      res.status(500).json({ error: "Failed to fetch vessels" });
    }
  });

  app.get("/api/vessels/export", async (req, res) => {
    try {
      const entries = await storage.getMasterDataEntries('014');
      
      // Generate CSV header
      const headers = ['Vessel Name', 'IMO Number', 'Vessel Type', 'Status'];
      const csvRows = [headers.join(',')];
      
      // Generate CSV rows
      for (const entry of entries) {
        const row = [
          `"${entry.name || ''}"`,
          `"${entry.description || ''}"`,
          `"${entry.vesselType || ''}"`,
          `"${entry.isActive ? 'Active' : 'Inactive'}"`
        ];
        csvRows.push(row.join(','));
      }
      
      const csvContent = csvRows.join('\n');
      
      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="vessels.csv"');
      res.send(csvContent);
    } catch (error) {
      console.error("❌ Failed to export vessels:", error);
      res.status(500).json({ error: "Failed to export vessels" });
    }
  });

  app.get("/api/vessels/:id/office-matrix", async (req, res) => {
    try {
      const vesselId = req.params.id;
      
      // Get vessel revisions for this vessel
      const revisions = await storage.getVesselRevisionsByVessel(vesselId);
      
      if (!revisions || revisions.length === 0) {
        return res.json({ 
          vesselId,
          message: "No office matrix data available for this vessel",
          revisions: []
        });
      }
      
      // Return the latest revision with its rank data
      const latestRevision = revisions[revisions.length - 1];
      
      res.json({
        vesselId,
        revision: latestRevision.revision,
        revisionDate: latestRevision.revisionDate,
        revisionData: JSON.parse(latestRevision.revisionData),
        allRevisions: revisions.map((r: any) => ({
          revision: r.revision,
          revisionDate: r.revisionDate
        }))
      });
    } catch (error) {
      console.error("❌ Failed to fetch office matrix:", error);
      res.status(500).json({ error: "Failed to fetch office matrix data" });
    }
  });

  // Master Data Entries API routes
  app.get("/api/masters/:id/data", async (req, res) => {
    try {
      const masterId = req.params.id;
      const entries = await storage.getMasterDataEntries(masterId);
      
      // Apply master-specific response mapping if needed
      let responseEntries = entries;
      if (needsSpecialHandling(masterId) && entries) {
        responseEntries = entries.map((entry: any) => applyMasterSpecificMapping(entry, masterId));
        // Only log in development mode for performance
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔧 [GET_LIST] Applied transformations for master ${masterId}, entries count: ${responseEntries.length}`);
        }
      } else if (entries) {
        // Apply basic field transformation for regular masters (snake_case to camelCase)
        responseEntries = entries.map((entry: any) => applyBasicFieldTransformation(entry));
        // Only log in development mode for performance
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔧 [GET_LIST] Applied basic field transformation for master ${masterId}, entries count: ${responseEntries.length}`);
        }
      }
      
      res.json(responseEntries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch master data entries" });
    }
  });

  app.get("/api/master-data/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const entry = await storage.getMasterDataEntry(id);
      if (!entry) {
        return res.status(404).json({ error: "Master data entry not found" });
      }
      
      // Apply master-specific response mapping if needed
      let responseEntry = entry;
      const masterId = (entry as any).master_id || (entry as any).masterId;
      if (needsSpecialHandling(masterId)) {
        responseEntry = applyMasterSpecificMapping(entry, masterId);
        console.log(`🔧 [GET_SINGLE] Applied transformations for master ${masterId}:`, responseEntry);
      } else {
        // Apply basic field transformation for regular masters (snake_case to camelCase)
        responseEntry = applyBasicFieldTransformation(entry);
        console.log(`🔧 [GET_SINGLE] Applied basic field transformation for master ${masterId}`);
      }
      
      res.json(responseEntry);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch master data entry" });
    }
  });

  app.post("/api/masters/:id/data", async (req, res) => {
    try {
      const masterId = req.params.id;
      console.log(`🔍 [DEBUG CREATE] Storage type: ${storage.constructor.name}, Master ID: ${masterId}, Payload:`, req.body);
      
      // Apply master-specific filtering and transformation BEFORE validation
      let requestData = { ...req.body, masterId };
      if (needsSpecialHandling(masterId)) {
        console.log(`🔧 [CREATE] Special master detected (${masterId}) - applying transformations BEFORE validation`);
        
        // Apply appropriate filtering/transformation based on master type
        requestData = applyMasterSpecificFiltering(requestData, masterId);
        console.log(`🔧 [CREATE] Filtered request data for validation:`, requestData);
        
        // Validate entry after transformation
        const validation = validateMasterSpecificEntry(requestData, masterId);
        if (!validation.isValid) {
          return res.status(400).json({ 
            error: `Invalid ${masterId} master data`, 
            details: validation.error 
          });
        }
      }
      
      const result = insertMasterDataEntrySchema.safeParse(requestData);
      if (!result.success) {
        console.log(`❌ [DEBUG CREATE] Validation failed:`, result.error.issues);
        return res.status(400).json({ error: "Invalid master data entry", details: result.error.issues });
      }
      
      console.log(`📤 [DEBUG CREATE] Calling storage.createMasterDataEntry with:`, result.data);
      const entry = await storage.createMasterDataEntry(result.data);
      console.log(`✅ [DEBUG CREATE] Created entry:`, entry);
      
      // Apply master-specific response mapping if needed
      let responseEntry = entry;
      if (needsSpecialHandling(masterId) && entry) {
        responseEntry = applyMasterSpecificMapping(entry, masterId);
        console.log(`🔧 [CREATE] Mapped response for master ${masterId}:`, responseEntry);
      }
      
      // Verify persistence by immediately fetching the entry
      if (entry && entry.id) {
        try {
          const fetchedEntry = await storage.getMasterDataEntry(entry.id);
          console.log(`🔎 [DEBUG CREATE] Immediate fetch result:`, fetchedEntry);
        } catch (fetchError) {
          console.log(`❌ [DEBUG CREATE] Immediate fetch failed:`, fetchError);
        }
      }
      
      res.status(201).json(responseEntry);
    } catch (error) {
      console.log(`💥 [DEBUG CREATE] Exception:`, error);
      res.status(500).json({ error: "Failed to create master data entry" });
    }
  });

  app.put("/api/master-data/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get existing entry to check master ID for special handling
      const existingEntry = await storage.getMasterDataEntry(id);
      if (!existingEntry) {
        return res.status(404).json({ error: "Master data entry not found" });
      }
      
      const masterId = (existingEntry as any).master_id;
      
      // Apply master-specific filtering and transformation BEFORE validation if needed
      let requestData = req.body;
      
      // Check if this is a description-only update (simple text entry)
      const isDescriptionOnlyUpdate = req.body.description !== undefined && 
        Object.keys(req.body).filter(key => key !== 'masterId' && key !== 'description').length === 0;
      
      if (needsSpecialHandling(masterId) && !isDescriptionOnlyUpdate) {
        console.log(`🔧 [UPDATE] Special master detected (${masterId}) for entry ${id} - applying transformations BEFORE validation`);
        
        // Apply appropriate filtering/transformation based on master type
        requestData = applyMasterSpecificFiltering(req.body, masterId);
        console.log(`🔧 [UPDATE] Original update data:`, req.body);
        console.log(`🔧 [UPDATE] Filtered update data for validation:`, requestData);
        
        // Validate entry after transformation
        if (req.body.vessel || req.body.name || req.body.vesselIds || req.body.VesselIDs) {
          const validation = validateMasterSpecificEntry(requestData, masterId);
          if (!validation.isValid) {
            return res.status(400).json({ 
              error: `Invalid ${masterId} master data`, 
              details: validation.error 
            });
          }
        }
      } else if (isDescriptionOnlyUpdate) {
        console.log(`📝 [UPDATE] Description-only update detected for entry ${id} - bypassing special transformations`);
      }
      
      const result = insertMasterDataEntrySchema.partial().safeParse(requestData);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid master data entry", details: result.error.issues });
      }
      
      const entry = await storage.updateMasterDataEntry(id, result.data);
      if (!entry) {
        return res.status(404).json({ error: "Master data entry not found" });
      }
      
      // Apply master-specific response mapping if needed
      let responseEntry = entry;
      if (needsSpecialHandling(masterId)) {
        responseEntry = applyMasterSpecificMapping(entry, masterId);
        console.log(`🔧 [UPDATE] Mapped response for master ${masterId}:`, responseEntry);
      }
      
      res.json(responseEntry);
    } catch (error) {
      console.error(`💥 [UPDATE] Exception:`, error);
      res.status(500).json({ error: "Failed to update master data entry" });
    }
  });

  app.delete("/api/master-data/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`🔍 [DEBUG DELETE] Storage type: ${storage.constructor.name}, Entry ID: ${id}`);
      
      // First check if entry exists
      try {
        const existingEntry = await storage.getMasterDataEntry(id);
        console.log(`🔎 [DEBUG DELETE] Pre-delete fetch result:`, existingEntry);
      } catch (fetchError) {
        console.log(`❌ [DEBUG DELETE] Pre-delete fetch failed:`, fetchError);
      }
      
      console.log(`📤 [DEBUG DELETE] Calling storage.deleteMasterDataEntry with ID: ${id}`);
      const deleted = await storage.deleteMasterDataEntry(id);
      console.log(`✅ [DEBUG DELETE] Delete result: ${deleted}`);
      
      if (!deleted) {
        console.log(`❌ [DEBUG DELETE] Entry not found in storage for ID: ${id}`);
        return res.status(404).json({ error: "Master data entry not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.log(`💥 [DEBUG DELETE] Exception:`, error);
      res.status(500).json({ error: "Failed to delete master data entry" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
