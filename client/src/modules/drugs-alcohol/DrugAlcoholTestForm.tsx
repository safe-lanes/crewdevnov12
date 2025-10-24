import { useState, useMemo, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Save, Send, Plus, Link as LinkIcon, Trash2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useVesselLookup } from '@/hooks/useVesselLookup';

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
  
  // B1. General Information
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
  
  // B2. Testing Equipment Details
  equipmentNotApplicable: z.boolean().optional(),
  testingEquipment: z.array(equipmentEntrySchema).optional(),
  
  // Part B - Personnel Details (to be added later)
});

type DrugAlcoholTestFormData = z.infer<typeof drugAlcoholTestFormSchema>;

interface DrugAlcoholTestFormProps {
  testType?: 'annual' | 'periodic' | 'monthly' | 'post-incident' | 'others';
  vesselId?: string;
  draftData?: any;
  onClose: () => void;
  onSave: (data: any) => void;
  onSubmit: (data: any) => void;
}

export function DrugAlcoholTestForm({
  testType,
  vesselId,
  draftData,
  onClose,
  onSave,
  onSubmit
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
  const { getVesselName } = useVesselLookup();

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
      testingEquipment: [],
    },
  });

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
                {/* B1. General Section */}
                <div>
                  <h4 className="text-md font-semibold mb-4" style={{ color: '#16569e' }}>
                    B1. General
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
                            <FormControl>
                              <Input {...field} placeholder="Vessel" className="bg-[#ffffff]" data-testid="input-vesselId" />
                            </FormControl>
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
                            <div className="flex flex-col gap-2 bg-[#ffffff] border rounded-md p-3">
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
                      
                      {showOtherTestsFields && (
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
                      )}
                      
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

                {/* B2. Testing Equipment Details */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-semibold" style={{ color: '#16569e' }}>
                      B2. Testing Equipment Details (e.g. Alcohol Meter)
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
                    <div key={equipment.id} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 p-4 border rounded-lg bg-gray-50">
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
              
              <div className="space-y-4">
                {/* Placeholder for Part B fields - will be added based on user's detailed instructions */}
                <p className="text-gray-500 text-sm">Personnel details fields will be added here</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full h-[calc(100vh-2rem)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-3 sm:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg sm:text-xl font-bold">Drug & Alcohol Test</h1>
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
