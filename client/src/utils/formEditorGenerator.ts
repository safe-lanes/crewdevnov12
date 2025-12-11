
import { z } from "zod";

// Base form section interface
export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
}

// Form field interface
export interface FormField {
  id: string;
  type: 'text' | 'select' | 'textarea' | 'date' | 'number' | 'checkbox' | 'radio' | 'table';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  validation?: z.ZodSchema;
  configurable?: boolean;
  visible?: boolean;
}

// Form template interface
export interface FormTemplate {
  name: string;
  sections: FormSection[];
  schema: z.ZodSchema;
}

// Predefined form templates
export const formTemplates: Record<string, FormTemplate> = {
  'Crew Promotion Form': {
    name: 'Crew Promotion Form',
    sections: [
      {
        id: 'A',
        title: 'Candidate Information',
        description: 'Enter details of the promotion candidate',
        fields: [
          {
            id: 'candidateName',
            type: 'text',
            label: 'Candidate Name',
            placeholder: 'Enter full name',
            required: true,
            configurable: false,
            visible: true
          },
          {
            id: 'currentRank',
            type: 'select',
            label: 'Current Rank',
            required: true,
            options: ['Third Officer', 'Second Officer', 'Chief Officer', 'Third Engineer', 'Second Engineer', 'Chief Engineer'],
            configurable: true,
            visible: true
          },
          {
            id: 'proposedRank',
            type: 'select',
            label: 'Proposed Rank',
            required: true,
            options: ['Second Officer', 'Chief Officer', 'Master', 'Second Engineer', 'Chief Engineer'],
            configurable: true,
            visible: true
          },
          {
            id: 'vessel',
            type: 'select',
            label: 'Current Vessel',
            required: true,
            options: ['MT Sail One', 'MT Sail Two', 'MT Sail Three', 'MV Sail Seven'],
            configurable: false,
            visible: true
          },
          {
            id: 'joinDate',
            type: 'date',
            label: 'Date Joined Current Rank',
            required: true,
            configurable: false,
            visible: true
          }
        ]
      },
      {
        id: 'B',
        title: 'Qualification Assessment',
        description: 'Evaluate candidate qualifications and experience',
        fields: [
          {
            id: 'qualifications',
            type: 'table',
            label: 'Qualifications & Certificates',
            required: true,
            configurable: true,
            visible: true
          },
          {
            id: 'experience',
            type: 'textarea',
            label: 'Relevant Experience',
            placeholder: 'Describe relevant experience...',
            required: true,
            configurable: false,
            visible: true
          },
          {
            id: 'performanceRating',
            type: 'select',
            label: 'Overall Performance Rating',
            required: true,
            options: ['5- Excellent', '4- Very Good', '3- Good', '2- Satisfactory', '1- Needs Improvement'],
            configurable: true,
            visible: true
          }
        ]
      },
      {
        id: 'C',
        title: 'Recommendation & Approval',
        description: 'Final recommendation and approval details',
        fields: [
          {
            id: 'recommendation',
            type: 'radio',
            label: 'Promotion Recommendation',
            required: true,
            options: ['Strongly Recommended', 'Recommended', 'Not Recommended'],
            configurable: false,
            visible: true
          },
          {
            id: 'comments',
            type: 'textarea',
            label: 'Additional Comments',
            placeholder: 'Add any additional comments...',
            required: false,
            configurable: false,
            visible: true
          },
          {
            id: 'approverName',
            type: 'text',
            label: 'Approver Name',
            required: true,
            configurable: false,
            visible: true
          },
          {
            id: 'approvalDate',
            type: 'date',
            label: 'Approval Date',
            required: true,
            configurable: false,
            visible: true
          }
        ]
      }
    ],
    schema: z.object({
      candidateName: z.string().min(1, "Candidate name is required"),
      currentRank: z.string().min(1, "Current rank is required"),
      proposedRank: z.string().min(1, "Proposed rank is required"),
      vessel: z.string().min(1, "Vessel is required"),
      joinDate: z.string().min(1, "Join date is required"),
      qualifications: z.array(z.object({
        id: z.string(),
        qualification: z.string(),
        issueDate: z.string(),
        expiryDate: z.string(),
        status: z.string()
      })).default([]),
      experience: z.string().min(1, "Experience is required"),
      performanceRating: z.string().min(1, "Performance rating is required"),
      recommendation: z.string().min(1, "Recommendation is required"),
      comments: z.string().optional(),
      approverName: z.string().min(1, "Approver name is required"),
      approvalDate: z.string().min(1, "Approval date is required")
    })
  },

  'Crew Training Form': {
    name: 'Crew Training Form',
    sections: [
      {
        id: 'A',
        title: 'Training Details',
        description: 'Enter training course information',
        fields: [
          {
            id: 'trainingName',
            type: 'text',
            label: 'Training Course Name',
            required: true,
            configurable: false,
            visible: true
          },
          {
            id: 'trainingProvider',
            type: 'text',
            label: 'Training Provider',
            required: true,
            configurable: false,
            visible: true
          },
          {
            id: 'trainingType',
            type: 'select',
            label: 'Training Type',
            required: true,
            options: ['STCW', 'Company Specific', 'Technical', 'Safety', 'Management'],
            configurable: true,
            visible: true
          },
          {
            id: 'startDate',
            type: 'date',
            label: 'Start Date',
            required: true,
            configurable: false,
            visible: true
          },
          {
            id: 'endDate',
            type: 'date',
            label: 'End Date',
            required: true,
            configurable: false,
            visible: true
          }
        ]
      },
      {
        id: 'B',
        title: 'Participant Information',
        description: 'Details of training participants',
        fields: [
          {
            id: 'participants',
            type: 'table',
            label: 'Training Participants',
            required: true,
            configurable: true,
            visible: true
          }
        ]
      },
      {
        id: 'C',
        title: 'Training Results',
        description: 'Training outcomes and certification',
        fields: [
          {
            id: 'completionStatus',
            type: 'select',
            label: 'Completion Status',
            required: true,
            options: ['Completed', 'In Progress', 'Failed', 'Cancelled'],
            configurable: true,
            visible: true
          },
          {
            id: 'certificateIssued',
            type: 'checkbox',
            label: 'Certificate Issued',
            required: false,
            configurable: false,
            visible: true
          },
          {
            id: 'remarks',
            type: 'textarea',
            label: 'Training Remarks',
            placeholder: 'Add training remarks...',
            required: false,
            configurable: false,
            visible: true
          }
        ]
      }
    ],
    schema: z.object({
      trainingName: z.string().min(1, "Training name is required"),
      trainingProvider: z.string().min(1, "Training provider is required"),
      trainingType: z.string().min(1, "Training type is required"),
      startDate: z.string().min(1, "Start date is required"),
      endDate: z.string().min(1, "End date is required"),
      participants: z.array(z.object({
        id: z.string(),
        name: z.string(),
        rank: z.string(),
        result: z.string()
      })).default([]),
      completionStatus: z.string().min(1, "Completion status is required"),
      certificateIssued: z.boolean().default(false),
      remarks: z.string().optional()
    })
  }
};

// Function to generate form editor component
export const generateFormEditor = (formName: string): string => {
  const template = formTemplates[formName];
  if (!template) {
    throw new Error(`Form template not found for: ${formName}`);
  }

  return `
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Settings } from "lucide-react";
import { Form } from "@shared/schema";
import { sailDesignSystem } from "@/config/sailDesignSystem";

const ${formName.replace(/\s+/g, '')}Schema = ${JSON.stringify(template.schema, null, 2)};

type ${formName.replace(/\s+/g, '')}Data = z.infer<typeof ${formName.replace(/\s+/g, '')}Schema>;

interface ${formName.replace(/\s+/g, '')}EditorProps {
  form: Form;
  rankGroupName?: string;
  onClose: () => void;
  onSave: (data: any) => void;
}

export const ${formName.replace(/\s+/g, '')}Editor: React.FC<${formName.replace(/\s+/g, '')}EditorProps> = ({ 
  form, 
  rankGroupName, 
  onClose, 
  onSave 
}) => {
  const [activeSection, setActiveSection] = useState("A");
  const [isConfigMode, setIsConfigMode] = useState(false);

  const formMethods = useForm<${formName.replace(/\s+/g, '')}Data>({
    resolver: zodResolver(${formName.replace(/\s+/g, '')}Schema),
    defaultValues: {
      // Add default values based on template fields
    },
  });

  const onSubmit = (data: ${formName.replace(/\s+/g, '')}Data) => {
    onSave({
      ...data,
      formId: form.id,
    });
    onClose();
  };

  const sections = ${JSON.stringify(template.sections.map(section => ({
    id: section.id,
    title: section.title,
    active: false
  })), null, 2)};

  const renderSection = (sectionId: string) => {
    const section = ${JSON.stringify(template.sections, null, 2)}.find(s => s.id === sectionId);
    if (!section) return null;

    return (
      <div className="space-y-6">
        <div className="pb-4 mb-6">
          <h3 className="text-xl font-semibold mb-2" style={{ color: sailDesignSystem.colors.primary }}>
            Part {section.id}: {section.title}
          </h3>
          {section.description && (
            <div style={{ color: sailDesignSystem.colors.primary }} className="text-sm">
              {section.description}
            </div>
          )}
          <div className="w-full h-0.5 mt-2" style={{ backgroundColor: sailDesignSystem.colors.primary }}></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {section.fields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.id} className="text-sm">{field.label}</Label>
              {field.type === 'text' && (
                <Input
                  id={field.id}
                  placeholder={field.placeholder}
                  {...formMethods.register(field.id)}
                  className="text-sm"
                />
              )}
              {field.type === 'select' && (
                <Select
                  value={formMethods.watch(field.id) || ""}
                  onValueChange={(value) => formMethods.setValue(field.id, value)}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select option" />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((option, index) => (
                      <SelectItem key={index} value={option.toLowerCase().replace(/\s+/g, '-')}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {field.type === 'textarea' && (
                <Textarea
                  id={field.id}
                  placeholder={field.placeholder}
                  {...formMethods.register(field.id)}
                  rows={3}
                />
              )}
              {field.type === 'date' && (
                <Input
                  id={field.id}
                  type="date"
                  {...formMethods.register(field.id)}
                  className="text-sm"
                />
              )}
              {field.type === 'checkbox' && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={field.id}
                    checked={formMethods.watch(field.id) || false}
                    onCheckedChange={(checked) => formMethods.setValue(field.id, checked)}
                  />
                  <Label htmlFor={field.id}>{field.label}</Label>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-[95vw] h-[calc(100vh-2rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold">${formName} - {rankGroupName || "Rank Group"}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={isConfigMode ? "default" : "outline"}
              onClick={() => setIsConfigMode(!isConfigMode)}
              className="flex items-center gap-2"
              size="sm"
            >
              <Settings className="h-4 w-4" />
              {isConfigMode ? "Exit Config" : "Configure Fields"}
            </Button>
            <Button 
              onClick={formMethods.handleSubmit(onSubmit)}
              className="flex items-center gap-2"
              size="sm"
            >
              <Save className="h-4 w-4" />
              Save Draft
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-72 overflow-y-auto bg-gray-50 border-r">
            <div className="p-6">
              <nav className="space-y-1">
                {sections.map((section, index) => {
                  const isActive = activeSection === section.id;
                  
                  return (
                    <div key={section.id} className="relative">
                      <button
                        onClick={() => setActiveSection(section.id)}
                        className={\`w-full flex items-center p-3 rounded-lg text-left transition-colors hover:bg-gray-50 \${
                          isActive ? "bg-blue-50" : ""
                        }\`}
                      >
                        <div 
                          className={\`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold mr-4 \${
                            isActive ? "bg-blue-600" : "bg-gray-400"
                          }\`}
                        >
                          {section.id}
                        </div>
                        <div className="flex-1">
                          <div className={\`font-medium text-sm \${isActive ? "text-blue-700" : "text-gray-700"}\`}>
                            {section.title}
                          </div>
                        </div>
                      </button>
                      {index < sections.length - 1 && (
                        <div className="absolute left-8 top-16 w-0.5 h-4 bg-gray-300"></div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
            <div className="p-6">
              <Card className="bg-white">
                <CardContent className="p-6">
                  {renderSection(activeSection)}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
`;
};

// Function to create form editor command
export const createFormEditor = (formName: string): void => {
  if (!formTemplates[formName]) {
    console.error(`Form template not found for: ${formName}`);
    return;
  }

  console.log(`Creating Form Editor for: ${formName}`);
  
  // Generate the form editor component code
  const editorCode = generateFormEditor(formName);
  
  // You can save this to a file or use it programmatically
  console.log("Generated Form Editor Component:", editorCode);
};
