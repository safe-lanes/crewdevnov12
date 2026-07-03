import { useState, useMemo, useRef, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Plus, Link as LinkIcon, Trash2, Calendar, Upload, FileText, AlertTriangle, Paperclip, Lock, LockOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useVesselLookup } from '@/hooks/useVesselLookup';
import { useRankOrdering } from '@/hooks/useRankOrdering';
import { usePermissions } from '@/contexts/PermissionsContext';
import { FileAttachmentDialog, type FileAttachment } from '@/components/FileAttachmentDialog';
import { generateDrugAlcoholTestPDF } from '@/lib/generateDrugAlcoholTestPDF';
import { useToast } from '@/hooks/use-toast';
import { drugsAlcoholApiV2 } from './api/drugsAlcoholApiV2';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';

function getCurrentLocalDateTime() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Equipment entry schema
const equipmentEntrySchema = z.object({
  id: z.string(),
  equipmentId: z.string().optional(),
  makeModel: z.string().optional(),
  serialNo: z.string().optional(),
  lastCalibrated: z.string().optional(),
});

// Form schema with all Part A fields
const drugAlcoholTestFormSchema = z.object({
  // Type selection
  testType: z.string().min(1, 'Test type is required'),
  
  // A1. General Information
  vesselId: z.string().optional(),
  placeLocation: z.string().optional(),
  alcoholDrugType: z.array(z.string()).optional(),
  initiatedBy: z.string().optional(),
  dateTimeTestCompleted: z.string().optional(),
  incidentTitle: z.string().optional(),
  incidentId: z.string().optional(),
  incidentDateTime: z.string().optional(),
  alcoholTestDateTime: z.string().optional(),
  drugTestDateTime: z.string().optional(),
  reasonForTesting: z.string().optional(),
  description: z.string().optional(),
  externalTestResultsDate: z.string().optional(),
  
  // A2. Testing Equipment Details
  equipmentNotApplicable: z.boolean().optional(),
  testingEquipment: z.array(equipmentEntrySchema).optional(),
  
  // Part B - Personnel Details
  personnelTested: z.array(z.object({
    id: z.string(),
    crewId: z.string().nullable().optional(),
    rank: z.string(),
    name: z.string(),
    alcoholTest: z.object({
      checked: z.boolean(),
      date: z.string().optional(),
      time: z.string().optional(),
    }).optional(),
    alcoholResults: z.string().optional(),
    alcoholViolation: z.boolean().optional(),
    drugTest: z.object({
      checked: z.boolean(),
      date: z.string().optional(),
      time: z.string().optional(),
    }).optional(),
    drugResults: z.string().optional(),
    drugViolation: z.boolean().optional(),
    witness: z.string().optional(),
  })).optional(),
  comments: z.string().optional(),
  masterDeputySignature: z.object({
    confirmed: z.boolean(),
    name: z.string().optional(),
    date: z.string().optional(),
  }).optional(),
  attachments: z.array(z.object({
    id: z.union([z.string(), z.coerce.number()]),
    name: z.string(),
    type: z.string().optional(),
    size: z.coerce.number().optional(),
    data: z.string().optional(),
    uploadedAt: z.string().optional(),
    attUuid: z.string().optional(),
    url: z.string().optional(),
  }).passthrough()).optional(),
});

function stripNulls(obj: any): any {
  if (obj === null) return undefined;
  if (Array.isArray(obj)) return obj.map(stripNulls);
  if (typeof obj === 'object' && obj !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = value === null ? undefined : stripNulls(value);
    }
    return result;
  }
  return obj;
}

type DrugAlcoholTestFormData = z.infer<typeof drugAlcoholTestFormSchema>;

interface DrugAlcoholTestFormV2Props {
  testType?: 'annual' | 'periodic' | 'monthly' | 'post-incident' | 'others';
  vesselId?: string;
  recordUuid?: string;
  draftData?: any;
  onClose: () => void;
  onSave: (data: any) => void;
  onSubmit: (data: any) => void;
  onDelete?: () => void;
}

export function DrugAlcoholTestForm_v2({
  testType,
  vesselId,
  recordUuid,
  draftData,
  onClose,
  onSave,
  onSubmit,
  onDelete
}: DrugAlcoholTestFormV2Props) {
  const [activeSection, setActiveSection] = useState<'A' | 'B'>('A');
  const [activeContinuousSection, setActiveContinuousSection] = useState<'A' | 'B'>('A');
  
  // State for signatory manual entry when multiple matches or no match found
  const [showSignatoryManualEntry, setShowSignatoryManualEntry] = useState(false);
  
  // State for attachment dialog
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);

  // Section refs for continuous scroll
  const partARef = useRef<HTMLDivElement>(null);
  const partBRef = useRef<HTMLDivElement>(null);
  const continuousScrollContainerRef = useRef<HTMLDivElement>(null);
  

  // Test type labels
  const testTypeLabels = {
    'annual': 'Annual D&A Test',
    'periodic': 'Periodic Alcohol Test',
    'monthly': 'Monthly Alcohol Test',
    'post-incident': 'Post Incident Test',
    'others': 'Other Tests'
  };

  // Vessel lookup hook
  const { getVesselName, vessels } = useVesselLookup();

  const { userType, myVessels, canCreate, permissions } = usePermissions();
  const isShipUser = userType === 'Ship';
  const shipUserVesselName = useMemo(() => {
    if (!isShipUser || myVessels.length === 0) return null;
    return myVessels[0].vessel;
  }, [isShipUser, myVessels]);

  // Fetch existing record for editing (V2 - uses UUID)
  const { data: existingRecord, isLoading: recordLoading, isError: recordError } = useQuery<any>({
    queryKey: ['v2', 'drugs-alcohol', recordUuid],
    queryFn: async () => {
      if (!recordUuid) return null;
      return drugsAlcoholApiV2.testRecords.getByUuid(recordUuid);
    },
    enabled: !!recordUuid,
    retry: 1,
  });

  // ---- Lock / Unlock (DA Lock / Unlock) ----
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canLockUnlock = permissions.length === 0 || canCreate('DA Lock / Unlock');
  const isSubmittedRecord = !!recordUuid && existingRecord?.status === 'submitted';
  const isFormLocked = existingRecord?.isLocked === true;

  // Submit confirmation dialog (shown only on the qualifying first submit)
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<any>(null);

  const lockMutation = useMutation({
    mutationFn: ({ uuid, isLocked }: { uuid: string; isLocked: boolean }) =>
      drugsAlcoholApiV2.testRecords.toggleLock(uuid, isLocked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['v2', 'drugs-alcohol'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v2/drugs-alcohol/test-records'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update lock state',
        variant: 'destructive',
      });
    },
  });

  const handleLockToggle = () => {
    if (!recordUuid) return;
    lockMutation.mutate({ uuid: recordUuid, isLocked: !isFormLocked });
  };

  const form = useForm<DrugAlcoholTestFormData>({
    resolver: zodResolver(drugAlcoholTestFormSchema),
    defaultValues: draftData || {
      testType: testType || '',
      vesselId: vesselId || '',
      placeLocation: '',
      alcoholDrugType: [],
      initiatedBy: '',
      dateTimeTestCompleted: '',
      incidentTitle: '',
      incidentId: '',
      incidentDateTime: '',
      alcoholTestDateTime: '',
      drugTestDateTime: '',
      reasonForTesting: '',
      description: '',
      externalTestResultsDate: '',
      equipmentNotApplicable: false,
      testingEquipment: [
        { id: `eq-${Date.now()}`, equipmentId: '', makeModel: '', serialNo: '', lastCalibrated: '' }
      ],
      personnelTested: [],
      comments: '',
      masterDeputySignature: {
        confirmed: false,
        name: '',
        date: '',
      },
      attachments: [],
    },
  });

  // Use useFieldArray for proper nested array management of personnelTested
  const { fields: personnelFields, replace: replacePersonnel, append: appendPersonnel } = useFieldArray({
    control: form.control,
    name: 'personnelTested',
    keyName: '_fieldId',
  });

  // Populate form with existing record data when editing
  useEffect(() => {
    if (existingRecord && recordUuid) {
      // Parse JSON fields that may be stored as strings
      const parseJsonField = (value: any) => {
        if (!value) return undefined;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        }
        return value;
      };

      const formData: Partial<DrugAlcoholTestFormData> = {
        testType: existingRecord.testType || testType || '',
        vesselId: existingRecord.vesselId || '',
        placeLocation: existingRecord.placeLocation || '',
        alcoholDrugType: parseJsonField(existingRecord.alcoholDrugType) || [],
        initiatedBy: existingRecord.initiatedBy || '',
        dateTimeTestCompleted: existingRecord.dateTimeTestCompleted || '',
        incidentTitle: existingRecord.incidentTitle || '',
        incidentId: existingRecord.incidentId || '',
        incidentDateTime: existingRecord.incidentDateTime || '',
        alcoholTestDateTime: existingRecord.alcoholTestDateTime || '',
        drugTestDateTime: existingRecord.drugTestDateTime || '',
        reasonForTesting: existingRecord.reasonForTesting || '',
        description: existingRecord.description || '',
        externalTestResultsDate: existingRecord.externalTestResultsDate || '',
        equipmentNotApplicable: existingRecord.equipmentNotApplicable || false,
        testingEquipment: stripNulls(parseJsonField(existingRecord.testingEquipment)) || [
          { id: `eq-${Date.now()}`, equipmentId: '', makeModel: '', serialNo: '', lastCalibrated: '' }
        ],
        personnelTested: (stripNulls(parseJsonField(existingRecord.personnelTested)) || []).map((p: any) => ({
          ...p,
          rank: p.rank ?? '',
          name: p.name ?? '',
        })),
        comments: existingRecord.comments || '',
        masterDeputySignature: stripNulls(parseJsonField(existingRecord.masterDeputySignature)) || {
          confirmed: false,
          name: '',
          date: '',
        },
        attachments: (stripNulls(parseJsonField(existingRecord.attachmentFile || existingRecord.attachments)) || []).map((att: any) => {
          const attUuid = att?.attUuid || att?.id;
          return attUuid && typeof attUuid === 'string'
            ? { ...att, viewUrl: att.viewUrl || `/api/v2/drugs-alcohol/attachments/${attUuid}/raw` }
            : att;
        }),
      };

      form.reset(formData as DrugAlcoholTestFormData);
      
    }
  }, [existingRecord, recordUuid, testType, form]);

  useEffect(() => {
    if (isShipUser && myVessels.length > 0 && vessels.length > 0) {
      const myVesselName = myVessels[0].vessel;
      const matchedVessel = vessels.find((v) => v.name === myVesselName);
      if (matchedVessel) {
        form.setValue('vesselId', matchedVessel.entryId);
      }
    }
  }, [isShipUser, myVessels, vessels, form]);

  // Watch the vessel ID from form to filter crew dynamically
  const formVesselId = form.watch('vesselId');
  
  // Active vessel ID: prefer form selection, fallback to prop
  const activeVesselId = formVesselId || vesselId || '';
  
  // Fetch on-board crew for the active vessel using V2 crew_assignments JOIN
  const { data: allCrewMembers = [], isFetching: isCrewFetching } = useQuery<any[]>({
    queryKey: ['v2', 'drugs-alcohol', 'crew', activeVesselId],
    queryFn: () => drugsAlcoholApiV2.crew.getOnboardByVessel(activeVesselId),
    enabled: !!activeVesselId,
  });

  // Use centralized rank ordering hook (single source of truth for all modules)
  const { getSortOrder, isLoading: isLoadingRanks } = useRankOrdering(activeVesselId);
  
  // Watch alcohol/drug type to conditionally show fields
  const alcoholDrugType = form.watch('alcoholDrugType') || [];
  const showAlcoholFields = alcoholDrugType.includes('Alcohol');
  const showDrugFields = alcoholDrugType.includes('Drug');

  // Sort V2 crew by rank order and map to personnel tested format
  // V2 endpoint already filters by vessel (crew_assignments.vessel_uuid + is_current=true)
  const vesselCrewPersonnel = useMemo(() => {
    if (!activeVesselId || allCrewMembers.length === 0) return [];
    
    return [...allCrewMembers]
      .sort((a: any, b: any) => {
        const orderA = getSortOrder(a.presentRank);
        const orderB = getSortOrder(b.presentRank);
        if (orderA !== orderB) return orderA - orderB;
        const aSuffix = a.presentRank?.includes('_') ? parseInt(a.presentRank.split('_')[1]) || 0 : 0;
        const bSuffix = b.presentRank?.includes('_') ? parseInt(b.presentRank.split('_')[1]) || 0 : 0;
        return aSuffix - bSuffix;
      })
      .map((crew: any) => ({
        id: crew.crewUuid || crew.id || `crew-${Date.now()}-${Math.random()}`,
        crewId: crew.crewUuid || null,
        rank: crew.presentRank || '',
        name: `${crew.firstName || ''} ${crew.familyName || ''}`.trim(),
        alcoholTest: { checked: false, date: '', time: '' },
        alcoholResults: '',
        alcoholViolation: false,
        drugTest: { checked: false, date: '', time: '' },
        drugResults: '',
        drugViolation: false,
        witness: '',
      }));
  }, [allCrewMembers, activeVesselId, getSortOrder]);

  const sortedVesselCrew = useMemo(() => {
    return [...allCrewMembers].sort((a: any, b: any) => {
      const orderA = getSortOrder(a.presentRank);
      const orderB = getSortOrder(b.presentRank);

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      const aSuffix = a.presentRank?.includes('_')
        ? parseInt(a.presentRank.split('_')[1]) || 0
        : 0;

      const bSuffix = b.presentRank?.includes('_')
        ? parseInt(b.presentRank.split('_')[1]) || 0
        : 0;

      return aSuffix - bSuffix;
    });
  }, [allCrewMembers, getSortOrder]);

  // Get logged-in user's designation from sessionStorage for digital confirmation
  const loggedInUserDesignation = useMemo(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return sessionStorage.getItem('crewDesignation') || '';
    }
    return '';
  }, []);
  
  // Get logged-in user's name from sessionStorage as fallback
  const loggedInUserName = useMemo(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return sessionStorage.getItem('crewUserName') || '';
    }
    return '';
  }, []);
  
  // Find crew member(s) matching the logged-in user's rank for digital confirmation
  // Uses exact rank match as per requirements
  const signatoryLookupResult = useMemo(() => {
    if (!activeVesselId || !loggedInUserDesignation) {
      return { type: 'no_match' as const, matches: [] };
    }
    
    // V2: allCrewMembers is already filtered by vessel via the API endpoint
    const matchingCrew = allCrewMembers
      .filter((crew: any) => 
        crew.presentRank === loggedInUserDesignation
      )
      .map((crew: any) => ({
        id: crew.crewUuid || crew.id,
        name: `${crew.firstName || ''} ${crew.familyName || ''}`.trim(),
        rank: crew.presentRank || '',
      }));
    
    if (matchingCrew.length === 0) {
      return { type: 'no_match' as const, matches: [] };
    } else if (matchingCrew.length === 1) {
      return { type: 'single_match' as const, matches: matchingCrew };
    } else {
      return { type: 'multiple_matches' as const, matches: matchingCrew };
    }
  }, [allCrewMembers, activeVesselId, loggedInUserDesignation]);

  // Sections definition
  const sections = useMemo(() => [
    { id: 'A' as const, title: 'Part A: Basic Information', number: 'A', ref: partARef },
    { id: 'B' as const, title: 'Part B: Personnel Details', number: 'B', ref: partBRef },
  ], []);

  // Intersection Observer for continuous scroll tracking
  useEffect(() => {
    if (!continuousScrollContainerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let mostVisible = entries[0];
        
        entries.forEach((entry) => {
          if (entry.intersectionRatio > mostVisible.intersectionRatio) {
            mostVisible = entry;
          }
        });

        if (mostVisible && mostVisible.intersectionRatio > 0.6) {
          const sectionId = mostVisible.target.getAttribute('data-section-id') as 'A' | 'B';
          if (sectionId && sectionId !== activeContinuousSection) {
            setActiveContinuousSection(sectionId);
          }
        }
      },
      {
        root: continuousScrollContainerRef.current,
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
        rootMargin: '-50px 0px -50px 0px'
      }
    );

    sections.forEach(section => {
      if (section.ref?.current) {
        observer.observe(section.ref.current);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [activeContinuousSection, sections]);

  // Populate personnelTested when crew members are loaded or vessel changes
  // Skip if editing (recordUuid provided) as personnel will be loaded from the existing record
  // IMPORTANT: Wait for ranks to load before populating to ensure correct sort order
  const lastSyncedVesselRef = useRef<string | null>(null);
  useEffect(() => {
    // New mode only: keep Part B crew in sync with the selected vessel.
    if (draftData || recordUuid) return;
    if (!formVesselId) return;

    // Wait until the selected vessel's crew + ranks have finished loading.
    if (isCrewFetching || isLoadingRanks) return;

    // Only re-sync when the vessel actually changed.
    if (lastSyncedVesselRef.current === formVesselId) return;

    replacePersonnel(vesselCrewPersonnel);
    lastSyncedVesselRef.current = formVesselId;
  }, [
    formVesselId,
    vesselCrewPersonnel,
    isCrewFetching,
    isLoadingRanks,
    draftData,
    recordUuid,
    replacePersonnel
  ]);

  // Watch dateTimeTestCompleted to auto-populate date fields in Part B1
  const dateTimeTestCompleted = form.watch('dateTimeTestCompleted');
  
  // Auto-copy date from Part A1 to all personnel date fields in Part B1
  useEffect(() => {
    if (!dateTimeTestCompleted || personnelFields.length === 0) return;
    
    // Extract date portion from datetime-local format (YYYY-MM-DDTHH:mm)
    const datePortion = dateTimeTestCompleted.split('T')[0];
    if (!datePortion) return;
    
    // Update all personnel entries with the date (only if their current date is empty)
    personnelFields.forEach((_, index) => {
      const currentAlcoholDate = form.getValues(`personnelTested.${index}.alcoholTest.date`);
      const currentDrugDate = form.getValues(`personnelTested.${index}.drugTest.date`);
      
      // Only auto-fill if the field is empty (don't overwrite user edits)
      if (!currentAlcoholDate) {
        form.setValue(`personnelTested.${index}.alcoholTest.date`, datePortion);
      }
      if (!currentDrugDate) {
        form.setValue(`personnelTested.${index}.drugTest.date`, datePortion);
      }
    });
  }, [dateTimeTestCompleted, personnelFields, form]);

  // Watch digital confirmation state
  const isConfirmed = form.watch('masterDeputySignature.confirmed');
  const currentSignatoryName = form.watch('masterDeputySignature.name');
  
  // Re-evaluate signatory when crew data loads after checkbox is already checked
  // This handles the race condition where user clicks checkbox before crew data finishes loading
  useEffect(() => {
    // Only run if checkbox is checked and we're in manual entry mode waiting for data
    if (!isConfirmed) return;
    
    // If we have a single match and name is empty or we're in manual mode
    if (signatoryLookupResult.type === 'single_match') {
      // Auto-populate if name is empty or doesn't match the lookup result
      const matchedName = signatoryLookupResult.matches[0].name;
      if (!currentSignatoryName || showSignatoryManualEntry) {
        form.setValue('masterDeputySignature.name', matchedName);
        setShowSignatoryManualEntry(false);
        
        // Also set date if empty
        if (!form.getValues('masterDeputySignature.date')) {
          const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
          form.setValue('masterDeputySignature.date', today);
        }
      }
    } else if (signatoryLookupResult.type === 'multiple_matches' && !showSignatoryManualEntry && !currentSignatoryName) {
      // Multiple matches and user hasn't selected yet - show dropdown
      setShowSignatoryManualEntry(true);
    }
  }, [isConfirmed, signatoryLookupResult, currentSignatoryName, showSignatoryManualEntry, form]);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSectionNavigation = (sectionId: 'A' | 'B') => {
    setActiveSection(sectionId);
    const section = sections.find(s => s.id === sectionId);
    if (section?.ref) {
      scrollToSection(section.ref);
    }
  };

  const sortPersonnelForSave = (personnel: any[]) => {
    const isOtherRow = (p: any) =>
      (typeof p?.id === 'string' && p.id.startsWith('other-')) ||
      (typeof p?.crewId === 'string' && p.crewId.startsWith('other-'));

    const getOtherCreationTime = (p: any): number => {
        const marker =
        (typeof p?.crewId === 'string' && p.crewId.startsWith('other-'))
          ? p.crewId
          : (typeof p?.id === 'string' && p.id.startsWith('other-'))
            ? p.id
            : '';

      const ts = parseInt(marker.split('-')[1] ?? '', 10);
      return Number.isFinite(ts) ? ts : 0;
    };

    return [...personnel].sort((a, b) => {
      const aOther = isOtherRow(a);
      const bOther = isOtherRow(b);

      // Added Other rows always below real crew
      if (aOther !== bOther) return aOther ? 1 : -1;

      // Other rows keep creation order
      if (aOther && bOther) {
        return getOtherCreationTime(a) - getOtherCreationTime(b);
      }

      // Real crew hierarchy sort
      const orderA = getSortOrder(a.rank);
      const orderB = getSortOrder(b.rank);

      if (orderA !== orderB) return orderA - orderB;
      const aSuffix = a.rank?.includes('_')
        ? parseInt(a.rank.split('_')[1]) || 0
        : 0;

      const bSuffix = b.rank?.includes('_')
        ? parseInt(b.rank.split('_')[1]) || 0
        : 0;

      return aSuffix - bSuffix;
    });
  };

  const handleSaveDraft = () => {
    const rawPersonnel = (form.getValues('personnelTested') as any[]) || [];

    const hasEmptyOther = rawPersonnel.some((p) => {
      const isOther =
        p?.id?.startsWith('other-') ||
        p?.crewId?.startsWith?.('other-');

      return (
        isOther &&
        (
          !String(p?.rank ?? '').trim() ||
          !String(p?.name ?? '').trim()
        )
      );
    });

    if (hasEmptyOther) {
      toast({
        title: 'Missing Rank or Name',
        description: 'Please enter both Rank and Name for all manually added personnel before saving.',
        variant: 'destructive',
      });
      return;
    }

    const data = form.getValues();

    const sortedPersonnel = sortPersonnelForSave(
      (data.personnelTested as any[]) || []
    );
    replacePersonnel(sortedPersonnel);

    onSave({
      ...data,
      personnelTested: sortedPersonnel,
    });
  };

  const handleExport = async () => {
    try {
      const data = form.getValues();
      const vesselName = getVesselName(data.vesselId || '');
      const resolveWitnessName = (witnessId: string) => {
        if (!witnessId) return '';

        const crew = allCrewMembers.find(
          (c: any) => c.crewUuid === witnessId || c.id === witnessId
        );

        if (!crew) return witnessId;

        const name = `${crew.firstName || ''} ${crew.familyName || ''}`.trim();
        const rank = crew.presentRank || '';

        return rank ? `${name}, ${rank}` : name;
      };
      await generateDrugAlcoholTestPDF({
        ...data,
        vesselName: vesselName || '',
        personnelTested: (data.personnelTested || []).map((person: any) => ({
          ...person,
          witness: resolveWitnessName(person.witness || ''),
        })),
      });
      toast({
        title: "Export Successful",
        description: "Drug & Alcohol Test form exported as PDF",
      });
    } catch (error) {
      console.error('Failed to export PDF:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFormSubmit = (data: DrugAlcoholTestFormData) => {
    const rawPersonnel = (form.getValues('personnelTested') as any[]) || [];

    const hasEmptyOther = rawPersonnel.some((p) => {
      const isOther =
        p?.id?.startsWith('other-') ||
        p?.crewId?.startsWith?.('other-');

      return (
        isOther &&
        (
          !String(p?.rank ?? '').trim() ||
          !String(p?.name ?? '').trim()
        )
      );
    });

    if (hasEmptyOther) {
      toast({
        title: 'Missing Rank or Name',
        description: 'Please enter both Rank and Name for all manually added personnel before saving.',
        variant: 'destructive',
      });
      return;
    }

    const cleanedData = {
      ...data,
      personnelTested: (data.personnelTested || []).map(person => {
        const hasAlcoholTest = person.alcoholTest?.checked;
        const hasDrugTest = person.drugTest?.checked;
        if (!hasAlcoholTest && !hasDrugTest) {
          return { ...person, witness: '' };
        }
        return person;
      })
    };

    const sortedPersonnel = sortPersonnelForSave(
      (cleanedData.personnelTested as any[]) || []
    );

    replacePersonnel(sortedPersonnel);

    const submitData = {
      ...cleanedData,
      personnelTested: sortedPersonnel,
    };

    // Qualifying first submit (new form, or existing record never locked before):
    // show the lock confirmation dialog before submitting.
    const isQualifyingFirstSubmit = !recordUuid || existingRecord?.lockedOnce !== true;
    if (isQualifyingFirstSubmit) {
      setPendingSubmitData(submitData);
      setLockDialogOpen(true);
      return;
    }

    onSubmit(submitData);
  };

  const handleConfirmLockSubmit = () => {
    setLockDialogOpen(false);
    if (pendingSubmitData) {
      onSubmit(pendingSubmitData);
      setPendingSubmitData(null);
    }
  };

  const handleCancelLockSubmit = () => {
    setLockDialogOpen(false);
    setPendingSubmitData(null);
  };

  const handleFormError = (errors: any) => {
    const extractMessage = (err: any, path: string): string | null => {
      if (!err) return null;
      if (err.message) return `${path}: ${err.message}`;
      if (err.root?.message) return `${path}: ${err.root.message}`;
      if (Array.isArray(err)) {
        for (let i = 0; i < err.length; i++) {
          if (err[i]) {
            for (const key of Object.keys(err[i])) {
              const msg = extractMessage(err[i][key], `${path}[${i}].${key}`);
              if (msg) return msg;
            }
          }
        }
      }
      if (typeof err === 'object') {
        for (const key of Object.keys(err)) {
          if (key === 'ref') continue;
          const msg = extractMessage(err[key], `${path}.${key}`);
          if (msg) return msg;
        }
      }
      return null;
    };

    let message = 'Please fix the form errors before submitting.';
    const errorKeys = Object.keys(errors);
    for (const key of errorKeys) {
      const msg = extractMessage(errors[key], key);
      if (msg) {
        message = msg;
        break;
      }
    }
    toast({
      title: "Validation Error",
      description: message,
      variant: "destructive",
    });
    console.error('Form validation errors:', JSON.stringify(errors, null, 2));
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
    }
  };

  // Watch testType to conditionally show fields
  const selectedTestType = form.watch('testType');
  const showPostIncidentFields = selectedTestType === 'post-incident';
  const showOtherTestsFields = selectedTestType === 'others';
  const showExternalResultsDate = ['annual', 'post-incident', 'others'].includes(selectedTestType);

  const alcoholTestDateTime = form.watch('alcoholTestDateTime');
  const drugTestDateTime = form.watch('drugTestDateTime');

  const externalResultsMinDate = useMemo(() => {
    if (selectedTestType === 'post-incident') {
      const dateParts = [alcoholTestDateTime, drugTestDateTime]
        .filter((v): v is string => !!v)
        .map((v) => v.split('T')[0]);

      return dateParts.length ? dateParts.sort()[0] : undefined;
    }

    return dateTimeTestCompleted
      ? dateTimeTestCompleted.split('T')[0]
      : undefined;
  }, [
    selectedTestType,
    dateTimeTestCompleted,
    alcoholTestDateTime,
    drugTestDateTime,
  ]);

  // Post Incident: auto-copy each test date into Part B
  // (date only, fill empty cells only — mirrors Annual behavior)
  useEffect(() => {
    if (selectedTestType !== 'post-incident' || personnelFields.length === 0) return;

    const alcoholDatePortion =
      showAlcoholFields && alcoholTestDateTime
        ? alcoholTestDateTime.split('T')[0]
        : '';

    const drugDatePortion =
      showDrugFields && drugTestDateTime
        ? drugTestDateTime.split('T')[0]
        : '';

    if (!alcoholDatePortion && !drugDatePortion) return;

    personnelFields.forEach((_, index) => {
      if (alcoholDatePortion) {
        const cur = form.getValues(`personnelTested.${index}.alcoholTest.date`);
        if (!cur) {
          form.setValue(
            `personnelTested.${index}.alcoholTest.date`,
            alcoholDatePortion
          );
        }
      }

      if (drugDatePortion) {
        const cur = form.getValues(`personnelTested.${index}.drugTest.date`);
        if (!cur) {
          form.setValue(
            `personnelTested.${index}.drugTest.date`,
            drugDatePortion
          );
        }
      }
    });
  }, [
    selectedTestType,
    showAlcoholFields,
    showDrugFields,
    alcoholTestDateTime,
    drugTestDateTime,
    personnelFields,
    form,
  ]);

  // Auto-fill test-completion date/time + handle Type-of-Test switches.
  // NEW forms only. Never overwrites existing/saved values (fills only when empty).
  // Crossing the Post-Incident boundary (either direction) clears the now-stale
  // Part A date(s) and the Part B date cells, then re-fills for the active type.
  const prevTestTypeRef = useRef(selectedTestType);

  useEffect(() => {
    // New forms only — existing records and drafts are never touched.
    if (recordUuid || draftData) {
      prevTestTypeRef.current = selectedTestType;
      return;
    }

    const prev = prevTestTypeRef.current;
    const next = selectedTestType;

    const crossingIntoPost =
      prev !== next && next === 'post-incident';

    const crossingOutOfPost =
      prev !== next &&
      prev === 'post-incident' &&
      next !== 'post-incident';

    prevTestTypeRef.current = next;

    // 1) On a Post-Incident boundary crossing, clear stale Part A + Part B dates.
    if (crossingIntoPost || crossingOutOfPost) {
      if (crossingIntoPost) {
        form.setValue('dateTimeTestCompleted', '');
      } else {
        form.setValue('alcoholTestDateTime', '');
        form.setValue('drugTestDateTime', '');
      }

      personnelFields.forEach((_, i) => {
        form.setValue(`personnelTested.${i}.alcoholTest.date`, '');
        form.setValue(`personnelTested.${i}.drugTest.date`, '');
      });
    }

    // 2) Auto-fill the field(s) relevant to the current type, only when empty.
    if (next === 'post-incident') {
      if (showAlcoholFields && !form.getValues('alcoholTestDateTime')) {
        form.setValue('alcoholTestDateTime', getCurrentLocalDateTime());
      }

      if (showDrugFields && !form.getValues('drugTestDateTime')) {
        form.setValue('drugTestDateTime', getCurrentLocalDateTime());
      }
    } else {
      if (!form.getValues('dateTimeTestCompleted')) {
        form.setValue('dateTimeTestCompleted', getCurrentLocalDateTime());
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    recordUuid,
    draftData,
    selectedTestType,
    showAlcoholFields,
    showDrugFields,
    personnelFields,
  ]);

  // Render continuous sections (Part A & Part B)
  const renderContinuousSections = () => {
    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Part A: Basic Information */}
        <div ref={partARef} data-section-id="A">
          <Card className="bg-white">
            <CardContent className="p-6">
              <div className="pb-4 mb-6">
                <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>
                  Part A Basic Information
                </h3>
                <div style={{ color: '#16569e' }} className="text-sm">
                  Enter details as applicable
                </div>
                <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
              </div>
              
              <div className="space-y-6">
                {/* A1. General Section */}
                <div>
                  <h4 className="text-md font-semibold mb-4" style={{ color: '#16569e' }}>
                    A1. General
                  </h4>
                  
                  <div className="space-y-4">
                    {/* Row 1: Vessel, Place/Location, Type of Test */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="vesselId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-gray-500 tracking-wide">Vessel<span className="text-red-500">*</span></FormLabel>
                            {(isShipUser || recordUuid) ? (
                              <div className="h-10 flex items-center text-sm font-medium text-[#0f172a] px-3 bg-gray-50 border border-input rounded-md" data-testid="text-vesselId-locked">
                                {isShipUser
                                  ? (shipUserVesselName || "No vessel assigned")
                                  : (getVesselName(field.value || '') || field.value || "No vessel selected")}
                              </div>
                            ) : (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-[#ffffff]" data-testid="select-vesselId">
                                    <SelectValue placeholder="Select Vessel" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {vessels.map((vessel) => (
                                    <SelectItem key={vessel.entryId} value={vessel.entryId}>
                                      {vessel.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="placeLocation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-gray-500 tracking-wide">Place / Location</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Place / Location" className="bg-[#ffffff]" data-testid="input-placeLocation" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="testType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-gray-500 tracking-wide">Type of Test<span className="text-red-500">*</span></FormLabel>
                            {recordUuid ? (
                              <div className="h-10 flex items-center text-sm font-medium text-[#0f172a] px-3 bg-gray-50 border border-input rounded-md" data-testid="text-testType-locked">
                                {testTypeLabels[field.value as keyof typeof testTypeLabels] || field.value || "No test type selected"}
                              </div>
                            ) : (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-[#ffffff]" data-testid="select-testType">
                                    <SelectValue placeholder="Type of Test" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="annual">Annual D&A Test</SelectItem>
                                  <SelectItem value="periodic">Periodic Alcohol Test</SelectItem>
                                  <SelectItem value="monthly">Monthly Alcohol Test</SelectItem>
                                  <SelectItem value="post-incident">Post Incident Test</SelectItem>
                                  <SelectItem value="others">Other Tests</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Row 2: Alcohol/Drug, Initiated By, Date & Time Test completed */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="alcoholDrugType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-gray-500 tracking-wide">Alcohol/ Drug<span className="text-red-500">*</span></FormLabel>
                            <div className="flex flex-row gap-4 bg-[#ffffff] border rounded-md p-3">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="alcohol-checkbox"
                                  checked={field.value?.includes('Alcohol')}
                                  onCheckedChange={(checked) => {
                                    const current = field.value || [];
                                    if (checked) {
                                      field.onChange([...current, 'Alcohol']);
                                    } else {
                                      field.onChange(current.filter(v => v !== 'Alcohol'));
                                    }
                                  }}
                                  data-testid="checkbox-alcohol"
                                />
                                <label htmlFor="alcohol-checkbox" className="text-sm cursor-pointer">
                                  Alcohol
                                </label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="drug-checkbox"
                                  checked={field.value?.includes('Drug')}
                                  onCheckedChange={(checked) => {
                                    const current = field.value || [];
                                    if (checked) {
                                      field.onChange([...current, 'Drug']);
                                    } else {
                                      field.onChange(current.filter(v => v !== 'Drug'));
                                    }
                                  }}
                                  data-testid="checkbox-drug"
                                />
                                <label htmlFor="drug-checkbox" className="text-sm cursor-pointer">
                                  Drug
                                </label>
                              </div>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="initiatedBy"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-gray-500 tracking-wide">Initiated By</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-[#ffffff]" data-testid="select-initiatedBy">
                                  <SelectValue placeholder="Initiated By" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Vessel - Master">Vessel - Master</SelectItem>
                                <SelectItem value="Vessel - Chief Engineer">Vessel - Chief Engineer</SelectItem>
                                <SelectItem value="Office - HSQ Dept.">Office - HSQ Dept.</SelectItem>
                                <SelectItem value="Office - Operations">Office - Operations</SelectItem>
                                <SelectItem value="Port Authority">Port Authority</SelectItem>
                                <SelectItem value="External Agency">External Agency</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {!showPostIncidentFields && (
                        <FormField
                          control={form.control}
                          name="dateTimeTestCompleted"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Date & Time Test completed</FormLabel>
                              <div className="relative">
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="datetime-local"
                                    className="bg-[#ffffff] pr-10 [&::-webkit-calendar-picker-indicator]:hidden"
                                    data-testid="input-dateTimeTestCompleted"
                                    onKeyDown={(e) => {
                                      if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                                        e.preventDefault();
                                      }
                                    }}
                                  />
                                </FormControl>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                                      data-testid="button-open-dateTimeTestCompleted-calendar"
                                    >
                                      <Calendar className="h-4 w-4 text-gray-500" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="end">
                                    <CalendarPicker
                                      mode="single"
                                      selected={field.value ? new Date(`${field.value.split('T')[0]}T00:00:00`) : undefined}
                                      onSelect={(date) => {
                                        if (!date) return;
                                        const yyyy = date.getFullYear();
                                        const mm = String(date.getMonth() + 1).padStart(2, '0');
                                        const dd = String(date.getDate()).padStart(2, '0');
                                        const datePart = `${yyyy}-${mm}-${dd}`;
                                        const now = new Date();
                                        const timePart =
                                          field.value && field.value.includes('T') && field.value.split('T')[1]
                                            ? field.value.split('T')[1]
                                            : `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                                        field.onChange(`${datePart}T${timePart}`);
                                      }}
                                      initialFocus
                                    />
                                    <div className="border-t p-3">
                                      <Input
                                        type="time"
                                        value={field.value && field.value.includes('T') ? field.value.split('T')[1] : ''}
                                        onChange={(e) => {
                                          if (!field.value) return;
                                          const now = new Date();
                                          const datePart = field.value.includes('T') ? field.value.split('T')[0] : field.value;
                                          const timePart = e.target.value
                                            ? e.target.value
                                            : `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                                          field.onChange(`${datePart}T${timePart}`);
                                        }}
                                        data-testid="input-time-dateTimeTestCompleted"
                                      />
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    {/* Row 3: Incident fields (conditional for post-incident) */}
                    {showPostIncidentFields && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="incidentTitle"
                            render={({ field }) => (
                              <FormItem>
                                <div className="flex items-center justify-between mb-1">
                                  <FormLabel className="text-xs text-gray-500 tracking-wide">Incident Title</FormLabel>
                                  <Button 
                                    type="button" 
                                    variant="link" 
                                    size="sm" 
                                    className="h-auto p-0 text-xs text-blue-600"
                                    data-testid="button-link-incident"
                                  >
                                    <LinkIcon className="h-3 w-3 mr-1" />
                                    Link
                                  </Button>
                                </div>
                                <FormControl>
                                  <Input {...field} placeholder="Incident Title" className="bg-[#ffffff]" data-testid="input-incidentTitle" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="incidentId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs text-gray-500 tracking-wide">Incident ID</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Incident ID" className="bg-[#ffffff]" data-testid="input-incidentId" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="incidentDateTime"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs text-gray-500 tracking-wide">Incident Date & Time</FormLabel>
                                <FormControl>
                                  <Input {...field} type="datetime-local" className="bg-[#ffffff]" data-testid="input-incidentDateTime" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="alcoholTestDateTime"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs text-gray-500 tracking-wide">Alcohol Test - Date & Time Completed</FormLabel>
                                <FormControl>
                                  <Input {...field} type="datetime-local" disabled={!showAlcoholFields} className="bg-[#ffffff]" data-testid="input-alcoholTestDateTime" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="drugTestDateTime"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs text-gray-500 tracking-wide">Drug Test - Date & Time Completed</FormLabel>
                                <FormControl>
                                  <Input {...field} type="datetime-local" disabled={!showDrugFields} className="bg-[#ffffff]" data-testid="input-drugTestDateTime" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </>
                    )}

                    {/* Row 4: Other tests fields (conditional for others) */}
                    {showOtherTestsFields && (
                      <div className="grid grid-cols-1 gap-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="reasonForTesting"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs text-gray-500 tracking-wide">Reason for Testing</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger className="bg-[#ffffff]" data-testid="select-reasonForTesting">
                                      <SelectValue placeholder="Reason for Testing" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Random Selection">Random Selection</SelectItem>
                                    <SelectItem value="Reasonable Cause">Reasonable Cause</SelectItem>
                                    <SelectItem value="Pre-Employment">Pre-Employment</SelectItem>
                                    <SelectItem value="Return to Duty">Return to Duty</SelectItem>
                                    <SelectItem value="Follow-up">Follow-up</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Description</FormLabel>
                              <FormControl>
                                <Textarea 
                                  {...field} 
                                  placeholder="Description" 
                                  className="bg-[#ffffff] min-h-[80px]" 
                                  data-testid="textarea-description"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {/* Row 5: Date External Test Results received (conditional) */}
                    {showExternalResultsDate && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="externalTestResultsDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Date External Test Results received</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="date"
                                  min={externalResultsMinDate}
                                  onChange={(e) => {
                                    const v = e.target.value;

                                    // Reject dates earlier than the allowed minimum.
                                    // Allow clearing and allow unrestricted entry when no floor exists.
                                    if (externalResultsMinDate && v && v < externalResultsMinDate) {
                                      return;
                                    }

                                    field.onChange(e);
                                  }}
                                  className="bg-[#ffffff]"
                                  data-testid="input-externalTestResultsDate"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* A2. Testing Equipment Details */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-semibold" style={{ color: '#16569e' }}>
                      A2. Testing Equipment Details (e.g. Alcohol Meter)
                    </h4>
                    <div className="flex items-center gap-4">
                      <FormField
                        control={form.control}
                        name="equipmentNotApplicable"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox 
                                checked={field.value} 
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-equipmentNA"
                              />
                            </FormControl>
                            <FormLabel className="text-xs text-gray-500 tracking-wide cursor-pointer">
                              N/A
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        className="text-xs"
                        onClick={() => {
                          const current = form.getValues('testingEquipment') || [];
                          form.setValue('testingEquipment', [
                            ...current,
                            { id: `eq-${Date.now()}`, equipmentId: '', makeModel: '', serialNo: '', lastCalibrated: '' }
                          ]);
                        }}
                        disabled={form.watch('equipmentNotApplicable')}
                        data-testid="button-add-equipment"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                  
                  {!form.watch('equipmentNotApplicable') && form.watch('testingEquipment')?.map((equipment, index) => (
                    <div key={equipment.id} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-testid={`equipment-entry-${index}`}>
                      <FormField
                        control={form.control}
                        name={`testingEquipment.${index}.equipmentId` as any}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-gray-500 tracking-wide">Equipment ID</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Equipment ID" className="bg-[#ffffff]" data-testid={`input-equipmentId-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`testingEquipment.${index}.makeModel` as any}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-gray-500 tracking-wide">Make / Model</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Make / Model" className="bg-[#ffffff]" data-testid={`input-makeModel-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`testingEquipment.${index}.serialNo` as any}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-gray-500 tracking-wide">Serial No.</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Serial No." className="bg-[#ffffff]" data-testid={`input-serialNo-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`testingEquipment.${index}.lastCalibrated` as any}
                        render={({ field }) => (
                          <FormItem className="relative">
                            <FormLabel className="text-xs text-gray-500 tracking-wide">Last Calibrated</FormLabel>
                            <div className="flex gap-1">
                              <FormControl>
                                <Input {...field} type="date" className="bg-[#ffffff] flex-1" data-testid={`input-lastCalibrated-${index}`} />
                              </FormControl>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-10 w-10 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  const current = form.getValues('testingEquipment') || [];
                                  form.setValue('testingEquipment', current.filter((_, i) => i !== index));
                                }}
                                data-testid={`button-remove-equipment-${index}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Part B: Personnel Details */}
        <div ref={partBRef} data-section-id="B">
          <Card className="bg-white">
            <CardContent className="p-6">
              <div className="pb-4 mb-6">
                <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>
                  Part B: Personnel Details
                </h3>
                <div style={{ color: '#16569e' }} className="text-sm">
                  Enter personnel testing details
                </div>
                <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
              </div>
              
              <div className="space-y-6">
                {/* B1. Personnel Tested Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-semibold" style={{ color: '#16569e' }}>
                      B1. Personnel Tested
                    </h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const otherKey =
                          `other-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

                        appendPersonnel({
                          id: otherKey,
                          crewId: otherKey,
                          rank: '',
                          name: '',
                          alcoholTest: { checked: false, date: '', time: '' },
                          alcoholResults: '',
                          alcoholViolation: false,
                          drugTest: { checked: false, date: '', time: '' },
                          drugResults: '',
                          drugViolation: false,
                          witness: '',
                        });
                      }}
                      className="flex items-center gap-1"
                      data-testid="button-add-other-personnel"
                    >
                      <Plus className="h-4 w-4" />
                      Add Other
                    </Button>
                  </div>

                  {/* Personnel Table - Horizontal Scroll */}
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full min-w-max bg-white">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wide border-r" style={{ position: 'sticky', left: 0, backgroundColor: '#f9fafb', zIndex: 20 }}>
                            Rank
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wide border-r" style={{ position: 'sticky', left: '80px', backgroundColor: '#f9fafb', zIndex: 20 }}>
                            Name
                          </th>
                          {showAlcoholFields && (
                            <>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wide min-w-[100px]">
                                Alcohol Test
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wide min-w-[120px]">
                                Date
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wide min-w-[70px]">
                                Time
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wide min-w-[85px]">
                                Results (BAC)
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wide min-w-[100px]">
                                Violation
                              </th>
                            </>
                          )}
                          {showDrugFields && (
                            <>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wide min-w-[100px]">
                                Drug Test
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wide min-w-[120px]">
                                Date
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wide min-w-[70px]">
                                Time
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wide min-w-[85px]">
                                Results
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wide min-w-[100px]">
                                Violation
                              </th>
                            </>
                          )}
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wide min-w-[150px]">
                            Witness
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {personnelFields.map((person, index) => {
                          const isOtherRow =
                            person.id.startsWith('other-') ||
                            ((person as any).crewId?.startsWith?.('other-') ?? false);
                          return (
                          <tr key={person._fieldId} className="border-b hover:bg-gray-50">
                            <td className="px-3 py-2 text-sm border-r" style={{ position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 20 }}>
                              {isOtherRow ? (
                                <FormField
                                  control={form.control}
                                  name={`personnelTested.${index}.rank`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          type="text"
                                          placeholder="Rank"
                                          className="bg-white text-xs h-8 min-w-[60px]"
                                          data-testid={`input-other-rank-${index}`}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              ) : (
                                <div className="min-w-[60px]">{(person as any).rank || 'N/A'}</div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-sm border-r" style={{ position: 'sticky', left: '80px', backgroundColor: 'white', zIndex: 20 }}>
                              {isOtherRow ? (
                                <FormField
                                  control={form.control}
                                  name={`personnelTested.${index}.name`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          type="text"
                                          placeholder="Name"
                                          className="bg-white text-xs h-8 min-w-[150px]"
                                          data-testid={`input-other-name-${index}`}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              ) : (
                                <div className="min-w-[150px]">{(person as any).name || 'N/A'}</div>
                              )}
                            </td>
                            
                            {showAlcoholFields && (
                              <>
                                <td className="px-3 py-2">
                                  <FormField
                                    control={form.control}
                                    name={`personnelTested.${index}.alcoholTest.checked`}
                                    render={({ field }) => (
                                      <FormItem className="flex items-center justify-center">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            data-testid={`checkbox-alcohol-test-${index}`}
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <FormField
                                    control={form.control}
                                    name={`personnelTested.${index}.alcoholTest.date`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input
                                            {...field}
                                            type="date"
                                            className="bg-white text-xs h-8"
                                            data-testid={`input-alcohol-date-${index}`}
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <FormField
                                    control={form.control}
                                    name={`personnelTested.${index}.alcoholTest.time`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input
                                            {...field}
                                            type="text"
                                            placeholder="HH:MM"
                                            maxLength={5}
                                            pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]"
                                            className="bg-white text-xs h-8"
                                            data-testid={`input-alcohol-time-${index}`}
                                            onChange={(e) => {
                                              let value = e.target.value.replace(/[^\d:]/g, '');
                                              if (value.length === 2 && !value.includes(':')) {
                                                value = value + ':';
                                              }
                                              field.onChange(value);
                                            }}
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <FormField
                                    control={form.control}
                                    name={`personnelTested.${index}.alcoholResults`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input
                                            {...field}
                                            placeholder="BAC"
                                            className="bg-white text-xs h-8"
                                            data-testid={`input-alcohol-results-${index}`}
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <FormField
                                    control={form.control}
                                    name={`personnelTested.${index}.alcoholViolation`}
                                    render={({ field }) => (
                                      <FormItem className="flex items-center justify-center">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            data-testid={`checkbox-alcohol-violation-${index}`}
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                              </>
                            )}
                            
                            {showDrugFields && (
                              <>
                                <td className="px-3 py-2">
                                  <FormField
                                    control={form.control}
                                    name={`personnelTested.${index}.drugTest.checked`}
                                    render={({ field }) => (
                                      <FormItem className="flex items-center justify-center">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            data-testid={`checkbox-drug-test-${index}`}
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <FormField
                                    control={form.control}
                                    name={`personnelTested.${index}.drugTest.date`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input
                                            {...field}
                                            type="date"
                                            className="bg-white text-xs h-8"
                                            data-testid={`input-drug-date-${index}`}
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <FormField
                                    control={form.control}
                                    name={`personnelTested.${index}.drugTest.time`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input
                                            {...field}
                                            type="text"
                                            placeholder="HH:MM"
                                            maxLength={5}
                                            pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]"
                                            className="bg-white text-xs h-8"
                                            data-testid={`input-drug-time-${index}`}
                                            onChange={(e) => {
                                              let value = e.target.value.replace(/[^\d:]/g, '');
                                              if (value.length === 2 && !value.includes(':')) {
                                                value = value + ':';
                                              }
                                              field.onChange(value);
                                            }}
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <FormField
                                    control={form.control}
                                    name={`personnelTested.${index}.drugResults`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input
                                            {...field}
                                            placeholder="Results"
                                            className="bg-white text-xs h-8"
                                            data-testid={`input-drug-results-${index}`}
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <FormField
                                    control={form.control}
                                    name={`personnelTested.${index}.drugViolation`}
                                    render={({ field }) => (
                                      <FormItem className="flex items-center justify-center">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            data-testid={`checkbox-drug-violation-${index}`}
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                </td>
                              </>
                            )}
                            
                            <td className="px-3 py-2">
                              <FormField
                                control={form.control}
                                name={`personnelTested.${index}.witness`}
                                render={({ field }) => {
                                  // V2: allCrewMembers is already filtered by vessel via the API endpoint
                                  const vesselCrew = sortedVesselCrew;
                                  const getCrewDisplayName = (crewId: string) => {
                                    const crew = vesselCrew.find((c: any) => c.crewUuid === crewId || c.id === crewId);
                                    if (!crew) return crewId;
                                    const name = `${crew.firstName || ''} ${crew.familyName || ''}`.trim();
                                    const rank = crew.presentRank || '';
                                    return rank ? `${name}, ${rank}` : name;
                                  };
                                  const handleWitnessChange = (value: string) => {
                                    // '__none__' is the "Clear" option; store it as empty
                                    field.onChange(value === '__none__' ? '' : value);
                                  };
                                  
                                  return (
                                    <FormItem>
                                      <Select onValueChange={handleWitnessChange} value={field.value}>
                                        <FormControl>
                                          <SelectTrigger className="bg-white text-xs h-8" data-testid={`select-witness-${index}`}>
                                            <SelectValue placeholder="Select">
                                              {field.value ? getCrewDisplayName(field.value) : 'Select'}
                                            </SelectValue>
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="__none__">— None —</SelectItem>
                                          {vesselCrew.map((crew, crewIndex) => {
                                            const uniqueKey = crew.id || `crew-${crewIndex}-${crew.firstName}-${crew.familyName}`;
                                            const uniqueValue = crew.id || `crew-${crewIndex}`;
                                            const name = `${crew.firstName || ''} ${crew.familyName || ''}`.trim();
                                            const rank = crew.presentRank || '';
                                            const displayText = rank ? `${name}, ${rank}` : name;
                                            return (
                                              <SelectItem 
                                                key={uniqueKey} 
                                                value={uniqueValue}
                                              >
                                                {displayText}
                                              </SelectItem>
                                            );
                                          })}
                                        </SelectContent>
                                      </Select>
                                    </FormItem>
                                  );
                                }}
                              />
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Comments Section */}
                <div>
                  <FormField
                    control={form.control}
                    name="comments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-gray-500 tracking-wide">Comments</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Enter comments..."
                            className="bg-white min-h-[100px]"
                            data-testid="textarea-comments"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Master/Deputy Section */}
                <div className="space-y-4">
                  <h4 className="text-md font-semibold" style={{ color: '#16569e' }}>
                    Master/ Deputy:
                  </h4>
                  
                  <div className="space-y-4">
                    {/* Digital Confirmation */}
                    <FormField
                      control={form.control}
                      name="masterDeputySignature.confirmed"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                field.onChange(checked);
                                
                                if (checked) {
                                  // Auto-populate date
                                  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
                                  form.setValue('masterDeputySignature.date', today);
                                  
                                  // Auto-populate name based on lookup result
                                  if (signatoryLookupResult.type === 'single_match') {
                                    // Single match - auto-populate name
                                    form.setValue('masterDeputySignature.name', signatoryLookupResult.matches[0].name);
                                    setShowSignatoryManualEntry(false);
                                  } else if (signatoryLookupResult.type === 'multiple_matches') {
                                    // Multiple matches - show dropdown for selection
                                    setShowSignatoryManualEntry(true);
                                    form.setValue('masterDeputySignature.name', '');
                                  } else {
                                    // No match - use sessionStorage name as fallback or show manual entry
                                    if (loggedInUserName) {
                                      form.setValue('masterDeputySignature.name', loggedInUserName);
                                      setShowSignatoryManualEntry(false);
                                    } else {
                                      setShowSignatoryManualEntry(true);
                                      form.setValue('masterDeputySignature.name', '');
                                    }
                                  }
                                } else {
                                  // Unchecked - clear fields
                                  form.setValue('masterDeputySignature.name', '');
                                  form.setValue('masterDeputySignature.date', '');
                                  setShowSignatoryManualEntry(false);
                                }
                              }}
                              data-testid="checkbox-digital-confirmation"
                            />
                          </FormControl>
                          <FormLabel className="text-sm !mt-0 cursor-pointer">
                            Digital Confirmation
                          </FormLabel>
                        </FormItem>
                      )}
                    />

                    {/* Signatory Display / Selection */}
                    {form.watch('masterDeputySignature.confirmed') && (
                      <>
                        {/* Multiple matches - show dropdown */}
                        {showSignatoryManualEntry && signatoryLookupResult.type === 'multiple_matches' && (
                          <div className="space-y-2">
                            <p className="text-xs text-amber-600">Multiple crew members found with rank "{loggedInUserDesignation}". Please select:</p>
                            <Select
                              value={form.watch('masterDeputySignature.name') || ''}
                              onValueChange={(value) => form.setValue('masterDeputySignature.name', value)}
                            >
                              <SelectTrigger className="bg-white" data-testid="select-signatory-name">
                                <SelectValue placeholder="Select name" />
                              </SelectTrigger>
                              <SelectContent>
                                {signatoryLookupResult.matches.map((match) => (
                                  <SelectItem key={match.id} value={match.name}>
                                    {match.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        
                        {/* No match - show manual entry */}
                        {showSignatoryManualEntry && signatoryLookupResult.type === 'no_match' && !loggedInUserName && (
                          <div className="space-y-2">
                            <p className="text-xs text-amber-600">Could not find crew member for rank "{loggedInUserDesignation || 'Unknown'}". Please enter name:</p>
                            <Input
                              value={form.watch('masterDeputySignature.name') || ''}
                              onChange={(e) => form.setValue('masterDeputySignature.name', e.target.value)}
                              placeholder="Enter signatory name"
                              className="bg-white"
                              data-testid="input-signatory-name"
                            />
                          </div>
                        )}
                        
                        {/* Display the confirmation (when name is available) */}
                        {form.watch('masterDeputySignature.name') && (
                          <div className="p-3 bg-gray-50 border rounded-md dark:bg-gray-800">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {form.watch('masterDeputySignature.name')}, {loggedInUserDesignation || 'Master'}, {form.watch('masterDeputySignature.date') || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Upload Section */}
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex items-center"
                        onClick={() => setAttachmentDialogOpen(true)}
                        data-testid="button-upload-attachment"
                      >
                        <Paperclip className="h-4 w-4 mr-2" />
                        Attachment(s)
                        {(form.watch('attachments')?.length || 0) > 0 && (
                          <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                            {form.watch('attachments')?.length}
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              onClick={form.handleSubmit(handleFormSubmit, handleFormError)}
              className="bg-green-600 hover:bg-green-700 text-white px-6"
              data-testid="button-submit-form"
            >
              Submit
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Show loading state while fetching existing record
  if (recordUuid && recordLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
        <div className="bg-white rounded-lg w-full max-w-lg p-8 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading test record...</p>
        </div>
      </div>
    );
  }

  // Show error state if record fetch failed
  if (recordUuid && recordError) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
        <div className="bg-white rounded-lg w-full max-w-lg p-8 flex flex-col items-center justify-center">
          <div className="text-red-500 mb-4">
            <AlertTriangle className="h-12 w-12" />
          </div>
          <p className="text-gray-800 font-semibold mb-2">Failed to load record</p>
          <p className="text-gray-600 text-center mb-4">The test record could not be loaded. Please try again.</p>
          <Button onClick={onClose} variant="outline" data-testid="button-close-error">
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-lg w-full h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-3 sm:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg sm:text-xl font-bold">{recordUuid ? 'Edit' : 'New'} Drug & Alcohol Test</h1>
          </div>
          <div className="flex gap-1 sm:gap-2">
            {isSubmittedRecord && canLockUnlock && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-gray-100"
                onClick={handleLockToggle}
                disabled={lockMutation.isPending}
                data-testid="button-lock-toggle"
                title={isFormLocked ? 'Unlock form' : 'Lock form'}
              >
                {isFormLocked
                  ? <Lock className="h-4 w-4 text-red-500" />
                  : <LockOpen className="h-4 w-4 text-gray-400" />
                }
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExport}
              className="items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-white border-gray-300 text-gray-700 shadow-sm hover:bg-gray-50 h-8 rounded-md px-3 text-xs hidden sm:flex"
              data-testid="button-export"
            >
              <FileText className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isFormLocked}
              className="bg-red-600 hover:bg-red-700 text-white px-3 hidden sm:flex items-center gap-2 h-8 rounded-md text-xs"
              data-testid="button-delete-form"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isFormLocked}
              className="sm:hidden bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-delete-form-mobile"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {!isSubmittedRecord && (
              <>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSaveDraft}
                  className="items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 text-primary-foreground shadow hover:bg-primary/90 h-8 rounded-md px-3 text-xs hidden sm:flex bg-[#5fa5fa]"
                  data-testid="button-save-draft"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Draft
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSaveDraft}
                  className="sm:hidden"
                  data-testid="button-save-draft-mobile"
                >
                  <Save className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Horizontal Stepper */}
        <div className="block sm:hidden bg-white border-b px-4 py-3">
          <nav className="flex justify-center space-x-4">
            {sections.map((section, index) => {
              const isActive = activeContinuousSection === section.id;
              
              return (
                <div key={section.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => handleSectionNavigation(section.id)}
                    className="flex items-center justify-center"
                    data-testid={`button-step-mobile-${section.id}`}
                  >
                    <span 
                      className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold shrink-0 ${
                        isActive 
                          ? "bg-blue-600 text-white" 
                          : "bg-gray-600 text-white"
                      }`}
                    >
                      {section.number}
                    </span>
                  </button>
                  {index < sections.length - 1 && (
                    <div className="w-8 h-0.5 bg-gray-300 mx-2"></div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-1 overflow-hidden bg-[#f8fafc]">
          {/* Left Sidebar - Enhanced Stepper (Hidden on Mobile) */}
          <aside className="hidden sm:block sticky top-0 self-start basis-20 md:basis-48 lg:basis-52 shrink-0 bg-[#f8fafc] border-r overflow-y-auto">
            <div className="p-3">
              <nav className="space-y-1">
                {sections.map((section) => {
                  const isActive = activeContinuousSection === section.id;
                  
                  return (
                    <div key={section.id} className="relative">
                      <button
                        type="button"
                        onClick={() => handleSectionNavigation(section.id)}
                        className={`group flex items-center w-full px-3 py-2 rounded-md transition-all border-l-4 min-h-[3rem] ${
                          isActive 
                            ? "bg-blue-50 border-blue-600 text-blue-700" 
                            : "border-transparent hover:bg-gray-100 text-gray-700"
                        }`}
                        aria-current={isActive ? "step" : undefined}
                        data-testid={`button-step-${section.id}`}
                      >
                        <span 
                          className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold shrink-0 ${
                            isActive 
                              ? "bg-blue-600 text-white" 
                              : "bg-gray-600 text-white"
                          }`}
                        >
                          {section.number}
                        </span>
                        <span 
                          className="hidden xl:block ml-3 text-left text-sm leading-tight flex-1"
                          data-testid={`text-step-title-${section.id}`}
                          title={section.title}
                          style={{ 
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {section.title}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main Content Area with Continuous Scroll */}
          <main className="flex-1 overflow-y-auto" ref={continuousScrollContainerRef}>
            <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit, handleFormError)} className="space-y-6">
                  <fieldset disabled={isFormLocked} className="space-y-6">
                    {renderContinuousSections()}
                  </fieldset>
                </form>
              </Form>
            </div>
          </main>
        </div>
      </div>
      
      {/* File Attachment Dialog */}
      <FileAttachmentDialog
        open={attachmentDialogOpen}
        onOpenChange={setAttachmentDialogOpen}
        attachments={(form.watch('attachments') || []) as any}
        onAttachmentsChange={(attachments) => form.setValue('attachments', attachments as any)}
        onDeleteAttachment={async (_id: number, attUuid: string) => {
          await drugsAlcoholApiV2.attachments.delete(attUuid);
        }}
        title="D&A Test Attachments"
        itemName={form.watch('vesselId') ? getVesselName(form.watch('vesselId') || '') : 'Drug & Alcohol Test'}
      />

      {/* Lock confirmation dialog (shown only on the qualifying first submit) */}
      <AlertDialog open={lockDialogOpen} onOpenChange={(open) => { if (!open) handleCancelLockSubmit(); }}>
        <AlertDialogContent data-testid="dialog-lock-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Lock Form on Submission?</AlertDialogTitle>
            <AlertDialogDescription>
              After Submission this form will be locked and cannot be edited, are you sure you want to lock it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelLockSubmit} data-testid="button-lock-cancel">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLockSubmit} data-testid="button-lock-confirm">
              Lock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
