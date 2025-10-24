import { useState, useMemo, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Form schema (placeholder - will be expanded with actual fields)
const drugAlcoholTestFormSchema = z.object({
  testType: z.string().min(1, 'Test type is required'),
  vesselId: z.string().optional(),
  // Part A fields - will be added
  // Part B fields - will be added
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

  const form = useForm<DrugAlcoholTestFormData>({
    resolver: zodResolver(drugAlcoholTestFormSchema),
    defaultValues: draftData || {
      testType: testType || '',
      vesselId: vesselId || '',
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
                  Part A: Basic Information
                </h3>
                <div style={{ color: '#16569e' }} className="text-sm">
                  Enter basic test information
                </div>
                <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="testType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-gray-500 tracking-wide">Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-[#ffffff]">
                              <SelectValue placeholder="Select test type" />
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
                  
                  {/* Placeholder for more fields - will be added based on user's detailed instructions */}
                  <FormField
                    control={form.control}
                    name="vesselId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-gray-500 tracking-wide">Vessel</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Select vessel" className="bg-[#ffffff]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
