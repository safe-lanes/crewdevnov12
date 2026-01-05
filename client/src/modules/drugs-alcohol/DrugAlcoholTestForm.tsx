import { useState, useMemo, useRef, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Save, Send, Plus, Link as LinkIcon, Trash2, Calendar, Upload, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useVesselLookup } from '@/hooks/useVesselLookup';
import { useRankOrdering } from '@/hooks/useRankOrdering';

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
  alcoholDrugType: z.array(z.string()).optional(), // Multi-select: ["Alcohol"], ["Drug"], or both
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
  attachmentFile: z.string().optional(),
});

type DrugAlcoholTestFormData = z.infer<typeof drugAlcoholTestFormSchema>;

interface DrugAlcoholTestFormProps {
  testType?: 'annual' | 'periodic' | 'monthly' | 'post-incident' | 'others';
  vesselId?: string;
  recordId?: number;
  draftData?: any;
  onClose: () => void;
  onSave: (data: any) => void;
  onSubmit: (data: any) => void;
  onDelete?: () => void;
}

export function DrugAlcoholTestForm({
  testType,
  vesselId,
  recordId,
  draftData,
  onClose,
  onSave,
  onSubmit,
  onDelete
}: DrugAlcoholTestFormProps) {
  const [activeSection, setActiveSection] = useState<'A' | 'B'>('A');
  const [activeContinuousSection, setActiveContinuousSection] = useState<'A' | 'B'>('A');

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

  // Fetch crew members for the vessel
  const { data: allCrewMembers = [] } = useQuery<any[]>({
    queryKey: ['/api/crew-members'],
  });

  // Fetch existing record for editing
  const { data: existingRecord, isLoading: recordLoading, isError: recordError } = useQuery<any>({
    queryKey: ['/api/drug-alcohol-tests', recordId],
    queryFn: async () => {
      if (!recordId) return null;
      const response = await fetch(`/api/drug-alcohol-tests/${recordId}`);
      if (!response.ok) throw new Error('Failed to fetch record');
      return response.json();
    },
    enabled: !!recordId,
    retry: 1,
  });

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
      attachmentFile: '',
    },
  });

  // Use useFieldArray for proper nested array management of personnelTested
  const { fields: personnelFields, replace: replacePersonnel, append: appendPersonnel } = useFieldArray({
    control: form.control,
    name: 'personnelTested',
  });

  // Populate form with existing record data when editing
  useEffect(() => {
    if (existingRecord && recordId) {
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
        testingEquipment: parseJsonField(existingRecord.testingEquipment) || [
          { id: `eq-${Date.now()}`, equipmentId: '', makeModel: '', serialNo: '', lastCalibrated: '' }
        ],
        personnelTested: parseJsonField(existingRecord.personnelTested) || [],
        comments: existingRecord.comments || '',
        masterDeputySignature: parseJsonField(existingRecord.masterDeputySignature) || {
          confirmed: false,
          name: '',
          date: '',
        },
        attachmentFile: existingRecord.attachmentFile || '',
      };

      form.reset(formData as DrugAlcoholTestFormData);
    }
  }, [existingRecord, recordId, testType, form]);

  // Watch the vessel ID from form to filter crew dynamically
  const formVesselId = form.watch('vesselId');
  
  // Active vessel ID: prefer form selection, fallback to prop
  const activeVesselId = formVesselId || vesselId || '';
  
  // Use centralized rank ordering hook (single source of truth for all modules)
  const { getSortOrder } = useRankOrdering(activeVesselId);
  
  // Watch alcohol/drug type to conditionally show fields
  const alcoholDrugType = form.watch('alcoholDrugType') || [];
  const showAlcoholFields = alcoholDrugType.includes('Alcohol');
  const showDrugFields = alcoholDrugType.includes('Drug');

  // Filter crew by vessel, sort by rank order, and map to personnel tested format
  const vesselCrewPersonnel = useMemo(() => {
    if (!activeVesselId) return [];
    
    return allCrewMembers
      .filter((crew: any) => crew.presentVessel === activeVesselId)
      .sort((a: any, b: any) => {
        const orderA = getSortOrder(a.presentRank);
        const orderB = getSortOrder(b.presentRank);
        if (orderA !== orderB) return orderA - orderB;
        // Secondary sort by suffix number (e.g., AB_1 before AB_2)
        const aSuffix = a.presentRank?.includes('_') ? parseInt(a.presentRank.split('_')[1]) || 0 : 0;
        const bSuffix = b.presentRank?.includes('_') ? parseInt(b.presentRank.split('_')[1]) || 0 : 0;
        return aSuffix - bSuffix;
      })
      .map((crew: any) => ({
        id: crew.id || `crew-${Date.now()}-${Math.random()}`,
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
  // Skip if editing (recordId provided) as personnel will be loaded from the existing record
  useEffect(() => {
    if (!draftData && !recordId && formVesselId) {
      // Only populate when creating new records, not when editing
      // Use personnelFields.length from useFieldArray for accurate count
      const shouldUpdate = personnelFields.length === 0 && vesselCrewPersonnel.length > 0;
      
      if (shouldUpdate) {
        // Use replacePersonnel from useFieldArray for proper state management
        replacePersonnel(vesselCrewPersonnel);
      }
    }
  }, [vesselCrewPersonnel, formVesselId, draftData, recordId, personnelFields.length, replacePersonnel]);

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

  const handleSaveDraft = () => {
    const data = form.getValues();
    onSave(data);
  };

  const handleFormSubmit = (data: DrugAlcoholTestFormData) => {
    onSubmit(data);
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
                            <FormLabel className="text-xs text-gray-500 tracking-wide">Vessel*</FormLabel>
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
                            <FormLabel className="text-xs text-gray-500 tracking-wide">Type of Test*</FormLabel>
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
                            <FormLabel className="text-xs text-gray-500 tracking-wide">Alcohol/ Drug*</FormLabel>
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
                              <FormControl>
                                <Input {...field} type="datetime-local" className="bg-[#ffffff]" data-testid="input-dateTimeTestCompleted" />
                              </FormControl>
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
                                  <Input {...field} type="datetime-local" className="bg-[#ffffff]" data-testid="input-alcoholTestDateTime" />
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
                                  <Input {...field} type="datetime-local" className="bg-[#ffffff]" data-testid="input-drugTestDateTime" />
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
                                <Input {...field} type="date" className="bg-[#ffffff]" data-testid="input-externalTestResultsDate" />
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
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-[#ffffff]" data-testid={`select-equipmentId-${index}`}>
                                  <SelectValue placeholder="Select Equipment" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="AL-001">AL-001 - Breathalyzer Pro</SelectItem>
                                <SelectItem value="AL-002">AL-002 - AlcoTest 6820</SelectItem>
                                <SelectItem value="AL-003">AL-003 - DrugCheck 5000</SelectItem>
                              </SelectContent>
                            </Select>
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
                              <Input {...field} placeholder="Make / Model" className="bg-[#f0f0f0]" disabled data-testid={`input-makeModel-${index}`} />
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
                              <Input {...field} placeholder="Serial No." className="bg-[#f0f0f0]" disabled data-testid={`input-serialNo-${index}`} />
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
                        appendPersonnel({
                          id: `other-${Date.now()}`,
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
                        {personnelFields.map((person, index) => (
                          <tr key={person.id} className="border-b hover:bg-gray-50">
                            <td className="px-3 py-2 text-sm border-r" style={{ position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 20 }}>
                              <div className="min-w-[60px]">{(person as any).rank || 'N/A'}</div>
                            </td>
                            <td className="px-3 py-2 text-sm border-r" style={{ position: 'sticky', left: '80px', backgroundColor: 'white', zIndex: 20 }}>
                              <div className="min-w-[150px]">{(person as any).name || 'N/A'}</div>
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
                                  const vesselCrew = allCrewMembers.filter(
                                    crew => crew.presentVessel === formVesselId || crew.presentVessel === vesselId
                                  );
                                  const getCrewDisplayName = (crewId: string) => {
                                    const crew = vesselCrew.find(c => c.id === crewId);
                                    return crew ? `${crew.firstName || ''} ${crew.familyName || ''}`.trim() : crewId;
                                  };
                                  return (
                                    <FormItem>
                                      <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                          <SelectTrigger className="bg-white text-xs h-8" data-testid={`select-witness-${index}`}>
                                            <SelectValue placeholder="Select">
                                              {field.value ? getCrewDisplayName(field.value) : 'Select'}
                                            </SelectValue>
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {vesselCrew.map((crew, crewIndex) => {
                                            const uniqueKey = crew.id || `crew-${crewIndex}-${crew.firstName}-${crew.familyName}`;
                                            const uniqueValue = crew.id || `crew-${crewIndex}`;
                                            return (
                                              <SelectItem 
                                                key={uniqueKey} 
                                                value={uniqueValue}
                                              >
                                                {`${crew.firstName || ''} ${crew.familyName || ''}`.trim()}
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
                        ))}
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
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-digital-confirmation"
                            />
                          </FormControl>
                          <FormLabel className="text-sm !mt-0 cursor-pointer">
                            Digital Confirmation
                          </FormLabel>
                        </FormItem>
                      )}
                    />

                    {/* Signatory Display */}
                    {form.watch('masterDeputySignature.confirmed') && (
                      <div className="p-3 bg-gray-50 border rounded-md">
                        <p className="text-sm text-gray-700">
                          {form.watch('masterDeputySignature.name') || 'John Adams'}, Master, {form.watch('masterDeputySignature.date') || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    )}

                    {/* Upload Section */}
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                        data-testid="button-upload-attachment"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Attachment
                      </Button>

                      {/* Show filename if exists */}
                      {form.watch('attachmentFile') && (
                        <div className="flex items-center gap-2 p-2 bg-gray-50 border rounded-md">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-700">{form.watch('attachmentFile')}</span>
                        </div>
                      )}
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
              variant="destructive"
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white px-6"
              data-testid="button-delete-form"
            >
              Delete
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              className="bg-[#5fa5fa] hover:bg-[#5fa5fa]/90 text-white border-0 px-6"
              data-testid="button-save-form"
            >
              Save
            </Button>
            <Button
              type="submit"
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
  if (recordId && recordLoading) {
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
  if (recordId && recordError) {
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
            <h1 className="text-lg sm:text-xl font-bold">{recordId ? 'Edit' : 'New'} Drug & Alcohol Test</h1>
          </div>
          <div className="flex gap-1 sm:gap-2">
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
            <Button 
              size="sm"
              onClick={form.handleSubmit(handleFormSubmit)}
              className="items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 text-primary-foreground shadow h-8 rounded-md px-3 text-xs hidden sm:flex bg-[#16569e] hover:bg-[#16569e]/90"
              data-testid="button-submit"
            >
              <Send className="h-4 w-4 mr-2" />
              Submit
            </Button>
            <Button 
              size="sm"
              onClick={form.handleSubmit(handleFormSubmit)}
              className="sm:hidden bg-[#16569e] hover:bg-[#16569e]/90"
              data-testid="button-submit-mobile"
            >
              <Send className="h-4 w-4" />
            </Button>
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
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
                  {renderContinuousSections()}
                </form>
              </Form>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
