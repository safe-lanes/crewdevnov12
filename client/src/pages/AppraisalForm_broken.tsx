import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save, Send, Plus, MessageSquare, Edit2, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Comprehensive list of world nationalities
const NATIONALITIES = [
  "Afghan", "Albanian", "Algerian", "American", "Andorran", "Angolan", "Antiguan", "Argentine", "Armenian", "Australian",
  "Austrian", "Azerbaijani", "Bahamian", "Bahraini", "Bangladeshi", "Barbadian", "Belarusian", "Belgian", "Belizean", "Beninese",
  "Bhutanese", "Bolivian", "Bosnian", "Brazilian", "British", "Bruneian", "Bulgarian", "Burkinabe", "Burmese", "Burundian",
  "Cambodian", "Cameroonian", "Canadian", "Cape Verdean", "Central African", "Chadian", "Chilean", "Chinese", "Colombian", "Comoran",
  "Congolese", "Costa Rican", "Croatian", "Cuban", "Cypriot", "Czech", "Danish", "Djibouti", "Dominican", "Dutch",
  "East Timorese", "Ecuadorean", "Egyptian", "Emirian", "Equatorial Guinean", "Eritrean", "Estonian", "Ethiopian", "Fijian", "Filipino",
  "Finnish", "French", "Gabonese", "Gambian", "Georgian", "German", "Ghanaian", "Greek", "Grenadian", "Guatemalan",
  "Guinea-Bissauan", "Guinean", "Guyanese", "Haitian", "Herzegovinian", "Honduran", "Hungarian", "I-Kiribati", "Icelander", "Indian",
  "Indonesian", "Iranian", "Iraqi", "Irish", "Israeli", "Italian", "Ivorian", "Jamaican", "Japanese", "Jordanian",
  "Kazakhstani", "Kenyan", "Kittian and Nevisian", "Kuwaiti", "Kyrgyz", "Laotian", "Latvian", "Lebanese", "Liberian", "Libyan",
  "Liechtensteiner", "Lithuanian", "Luxembourger", "Macedonian", "Malagasy", "Malawian", "Malaysian", "Maldivan", "Malian", "Maltese",
  "Marshallese", "Mauritanian", "Mauritian", "Mexican", "Micronesian", "Moldovan", "Monacan", "Mongolian", "Moroccan", "Mosotho",
  "Motswana", "Mozambican", "Namibian", "Nauruan", "Nepalese", "New Zealander", "Nicaraguan", "Nigerian", "Nigerien", "North Korean",
  "Northern Irish", "Norwegian", "Omani", "Pakistani", "Palauan", "Panamanian", "Papua New Guinean", "Paraguayan", "Peruvian", "Polish",
  "Portuguese", "Qatari", "Romanian", "Russian", "Rwandan", "Saint Lucian", "Salvadoran", "Samoan", "San Marinese", "Sao Tomean",
  "Saudi", "Scottish", "Senegalese", "Serbian", "Seychellois", "Sierra Leonean", "Singaporean", "Slovakian", "Slovenian", "Solomon Islander",
  "Somali", "South African", "South Korean", "Spanish", "Sri Lankan", "Sudanese", "Surinamer", "Swazi", "Swedish", "Swiss",
  "Syrian", "Taiwanese", "Tajik", "Tanzanian", "Thai", "Togolese", "Tongan", "Trinidadian or Tobagonian", "Tunisian", "Turkish",
  "Tuvaluan", "Ugandan", "Ukrainian", "Uruguayan", "Uzbekistani", "Venezuelan", "Vietnamese", "Welsh", "Yemenite", "Zambian", "Zimbabwean"
];

// Training and Target schemas
const trainingSchema = z.object({
  id: z.string(),
  training: z.string().min(1, "Training name is required"),
  evaluation: z.string().min(1, "Evaluation is required"),
  comment: z.string().optional(),
});

const targetSchema = z.object({
  id: z.string(),
  targetSetting: z.string().min(1, "Target setting is required"),
  evaluation: z.string().min(1, "Evaluation is required"),
  comment: z.string().optional(),
});

// Competence Assessment schema
const competenceAssessmentSchema = z.object({
  id: z.string(),
  assessmentCriteria: z.string(),
  weight: z.number(),
  effectiveness: z.string().min(1, "Effectiveness rating is required"),
  comment: z.string().optional(),
});

// Behavioural Assessment schema
const behaviouralAssessmentSchema = z.object({
  id: z.string(),
  assessmentCriteria: z.string(),
  weight: z.number(),
  effectiveness: z.string().min(1, "Effectiveness rating is required"),
  comment: z.string().optional(),
});

// Training Needs schema
const trainingNeedsSchema = z.object({
  id: z.string(),
  training: z.string().min(1, "Training name is required"),
  comment: z.string().optional(),
});

// Part F schemas
const recommendationSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.enum(["Yes", "No", "NA"]),
  comment: z.string().optional(),
});

const appraiserCommentSchema = z.object({
  id: z.string(),
  name: z.string(),
  rank: z.string(),
  comment: z.string(),
});

const seafarerCommentSchema = z.object({
  id: z.string(),
  name: z.string(),
  rank: z.string(),
  comment: z.string(),
});

// Part G schemas
const officeReviewSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.string(),
  feedback: z.string(),
});

const trainingFollowupSchema = z.object({
  id: z.string(),
  training: z.string(),
  correspondingInDB: z.string(),
  category: z.string(),
  status: z.enum(["Proposed", "Approved", "Planned", "Declined", "Completed"]),
  targetDate: z.string().optional(),
  comment: z.string().optional(),
});

const appraisalSchema = z.object({
  // Part A: Seafarer's Information
  seafarersName: z.string().min(1, "Seafarer's name is required"),
  seafarersRank: z.string().min(1, "Seafarer's rank is required"),
  nationality: z.string().min(1, "Nationality is required"),
  vessel: z.string().min(1, "Vessel is required"),
  signOn: z.string().min(1, "Sign On date is required"),
  appraisalType: z.string().min(1, "Appraisal type is required"),
  appraisalPeriodFrom: z.string().min(1, "Appraisal period from is required"),
  appraisalPeriodTo: z.string().min(1, "Appraisal period to is required"),
  personalityIndexCategory: z.string().min(1, "Personality Index category is required"),
  primaryAppraiser: z.string().min(1, "Primary appraiser is required"),
  
  // Part B: Information at Start of Appraisal Period
  trainings: z.array(trainingSchema).default([]),
  targets: z.array(targetSchema).default([]),
  
  // Part C: Competence Assessment
  competenceAssessments: z.array(competenceAssessmentSchema).default([]),
  
  // Part D: Behavioural Assessment
  behaviouralAssessments: z.array(behaviouralAssessmentSchema).default([]),
  
  // Part E: Training Needs & Development
  trainingNeeds: z.array(trainingNeedsSchema).default([]),
  
  // Part F: Comments & Recommendations
  recommendations: z.array(recommendationSchema).default([]),
  appraiserComments: z.array(appraiserCommentSchema).default([]),
  seafarerComments: z.array(seafarerCommentSchema).default([]),
  
  // Part G: Office Review & Followup
  officeReviews: z.array(officeReviewSchema).default([]),
  trainingFollowups: z.array(trainingFollowupSchema).default([]),
});

type AppraisalFormData = z.infer<typeof appraisalSchema>;

interface AppraisalFormProps {
  crewMember?: {
    id: string;
    name: { first: string; middle: string; last: string };
    rank: string;
    vessel: string;
  };
  onClose: () => void;
}

export const AppraisalForm: React.FC<AppraisalFormProps> = ({ crewMember, onClose }) => {
  const [activeSection, setActiveSection] = useState("reference");
  const [editingTraining, setEditingTraining] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [trainingComments, setTrainingComments] = useState<{[key: string]: string}>({});
  const [targetComments, setTargetComments] = useState<{[key: string]: string}>({});
  const [competenceComments, setCompetenceComments] = useState<{[key: string]: string}>({});
  const [behaviouralComments, setBehaviouralComments] = useState<{[key: string]: string}>({});
  const [trainingNeedsComments, setTrainingNeedsComments] = useState<{[key: string]: string}>({});
  const [recommendationComments, setRecommendationComments] = useState<{[key: string]: string}>({});
  const [editingAppraiserComment, setEditingAppraiserComment] = useState<string | null>(null);
  const [editingSeafarerComment, setEditingSeafarerComment] = useState<string | null>(null);
  const [nationalityOpen, setNationalityOpen] = useState(false);
  const [editingOfficeReview, setEditingOfficeReview] = useState<string | null>(null);

  const form = useForm<AppraisalFormData>({
    resolver: zodResolver(appraisalSchema),
    defaultValues: {
      seafarersName: crewMember ? `${crewMember.name.first} ${crewMember.name.middle} ${crewMember.name.last}`.trim() : "",
      seafarersRank: "",
      nationality: "",
      vessel: "",
      signOn: "",
      appraisalType: "",
      appraisalPeriodFrom: "",
      appraisalPeriodTo: "",
      personalityIndexCategory: "",
      primaryAppraiser: "",
      trainings: [],
      targets: [],
      competenceAssessments: [
        { id: "1", assessmentCriteria: "Safety Performance and Open Reporting", weight: 10, effectiveness: "", comment: "" },
        { id: "2", assessmentCriteria: "Shipboard operational performance & technical skills - Navigation", weight: 10, effectiveness: "", comment: "" },
        { id: "3", assessmentCriteria: "Assessment Criteria 3", weight: 10, effectiveness: "", comment: "" },
        { id: "4", assessmentCriteria: "Assessment Criteria 4", weight: 10, effectiveness: "", comment: "" },
        { id: "5", assessmentCriteria: "Assessment Criteria 5", weight: 10, effectiveness: "", comment: "" },
        { id: "6", assessmentCriteria: "Assessment Criteria 6", weight: 10, effectiveness: "", comment: "" },
        { id: "7", assessmentCriteria: "Assessment Criteria 7", weight: 10, effectiveness: "", comment: "" },
        { id: "8", assessmentCriteria: "Assessment Criteria 8", weight: 10, effectiveness: "", comment: "" },
        { id: "9", assessmentCriteria: "Assessment Criteria 9", weight: 10, effectiveness: "", comment: "" },
        { id: "10", assessmentCriteria: "Assessment Criteria 10", weight: 10, effectiveness: "", comment: "" }
      ],

      behaviouralAssessments: [
        { id: "1", assessmentCriteria: "Leadership", weight: 10, effectiveness: "", comment: "" },
        { id: "2", assessmentCriteria: "Attitude", weight: 10, effectiveness: "", comment: "" },
        { id: "3", assessmentCriteria: "Emotional Intelligence", weight: 10, effectiveness: "", comment: "" },
        { id: "4", assessmentCriteria: "Work Ethics", weight: 10, effectiveness: "", comment: "" },
        { id: "5", assessmentCriteria: "Situational Awareness", weight: 10, effectiveness: "", comment: "" },
        { id: "6", assessmentCriteria: "Decision Making", weight: 10, effectiveness: "", comment: "" },
        { id: "7", assessmentCriteria: "Teamwork", weight: 10, effectiveness: "", comment: "" },
        { id: "8", assessmentCriteria: "Assessment Criteria 8", weight: 10, effectiveness: "", comment: "" },
        { id: "9", assessmentCriteria: "Assessment Criteria 9", weight: 10, effectiveness: "", comment: "" },
        { id: "10", assessmentCriteria: "Assessment Criteria 10", weight: 10, effectiveness: "", comment: "" }
      ],

      trainingNeeds: [],
      
      // Part F: Comments & Recommendations
      recommendations: [
        { id: "1", question: "Recommended for continued service on board?", answer: "Yes", comment: "" },
        { id: "2", question: "Recommended for re-employment?", answer: "Yes", comment: "" },
        { id: "3", question: "Recommended for promotion?", answer: "Yes", comment: "" },
        { id: "4", question: "Career Development recommendations (If Any)?", answer: "Yes", comment: "" },
      ],
      appraiserComments: [
        { id: "primary", name: "", rank: "", comment: "" }
      ],
      seafarerComments: [
        { id: "seafarer", name: "", rank: "", comment: "" }
      ],
      
      // Part G: Office Review & Followup
      officeReviews: [
        { id: "1", name: "Roxanne", position: "Crewing Executive", feedback: "Candidate's feedback over conduct was positive. No issues reported" },
        { id: "2", name: "Joseph Hall", position: "Crew Manager", feedback: "Exception granted to this candidate as per discussion with Department Manager" }
      ],
      trainingFollowups: [
        { id: "1", training: "Training 1", correspondingInDB: "Select Training from DB", category: "Select Rating", status: "Proposed", targetDate: "", comment: "" },
        { id: "2", training: "Training 2", correspondingInDB: "Select Training from DB", category: "1. Competence", status: "Approved", targetDate: "", comment: "" },
        { id: "3", training: "Training 3", correspondingInDB: "Select Training from DB", category: "2- Soft Skills", status: "Planned", targetDate: "", comment: "" },
        { id: "4", training: "Training 4", correspondingInDB: "Select Training from DB", category: "1. Competence", status: "Declined", targetDate: "", comment: "The officer will no longer be sent on this type of vessel, so this training is not required." },
        { id: "5", training: "Training 5", correspondingInDB: "Select Training from DB", category: "2- Soft Skills", status: "Completed", targetDate: "", comment: "" }
      ],
    },
  });

  const onSubmit = (data: AppraisalFormData) => {
    console.log("Appraisal form submitted:", data);
    // Handle form submission here
    onClose();
  };

  // Training management functions
  const addTraining = () => {
    const newTraining = {
      id: Date.now().toString(),
      training: "",
      evaluation: "",
      comment: "",
    };
    const currentTrainings = form.getValues("trainings");
    form.setValue("trainings", [...currentTrainings, newTraining]);
  };

  const deleteTraining = (id: string) => {
    const currentTrainings = form.getValues("trainings");
    form.setValue("trainings", currentTrainings.filter(t => t.id !== id));
    setTrainingComments(prev => {
      const newComments = { ...prev };
      delete newComments[id];
      return newComments;
    });
  };

  const updateTraining = (id: string, field: string, value: string) => {
    const currentTrainings = form.getValues("trainings");
    const updatedTrainings = currentTrainings.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    );
    form.setValue("trainings", updatedTrainings);
  };

  // Target management functions
  const addTarget = () => {
    const newTarget = {
      id: Date.now().toString(),
      targetSetting: "",
      evaluation: "",
      comment: "",
    };
    const currentTargets = form.getValues("targets");
    form.setValue("targets", [...currentTargets, newTarget]);
  };

  const deleteTarget = (id: string) => {
    const currentTargets = form.getValues("targets");
    form.setValue("targets", currentTargets.filter(t => t.id !== id));
    setTargetComments(prev => {
      const newComments = { ...prev };
      delete newComments[id];
      return newComments;
    });
  };

  const updateTarget = (id: string, field: string, value: string) => {
    const currentTargets = form.getValues("targets");
    const updatedTargets = currentTargets.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    );
    form.setValue("targets", updatedTargets);
  };

  // Competence Assessment management functions
  const updateCompetenceAssessment = (id: string, field: string, value: string | number) => {
    const currentAssessments = form.getValues("competenceAssessments");
    const updatedAssessments = currentAssessments.map(a => 
      a.id === id ? { ...a, [field]: value } : a
    );
    form.setValue("competenceAssessments", updatedAssessments);
  };

  // Behavioural Assessment management functions
  const updateBehaviouralAssessment = (id: string, field: string, value: string | number) => {
    const currentAssessments = form.getValues("behaviouralAssessments");
    const updatedAssessments = currentAssessments.map(a => 
      a.id === id ? { ...a, [field]: value } : a
    );
    form.setValue("behaviouralAssessments", updatedAssessments);
  };

  // Helper function to get score colors based on rating value
  const getScoreColors = (score: number) => {
    if (score >= 4.0) {
      return { bgColor: 'bg-green-500', textColor: 'text-white' };
    } else if (score >= 3.0) {
      return { bgColor: 'bg-yellow-400', textColor: 'text-black' };
    } else if (score >= 2.0) {
      return { bgColor: 'bg-red-200', textColor: 'text-red-800' };
    } else {
      return { bgColor: 'bg-red-600', textColor: 'text-white' };
    }
  };

  // Calculate section score based on weight and effectiveness
  const calculateSectionScore = () => {
    const assessments = form.watch("competenceAssessments");
    let totalScore = 0;
    let totalWeight = 0;
    
    assessments.forEach(assessment => {
      if (assessment.effectiveness && assessment.weight) {
        let rating = 0;
        switch (assessment.effectiveness) {
          case "5-exceeds-expectations": rating = 5; break;
          case "4-meets-expectations": rating = 4; break;
          case "3-somewhat-meets-expectations": rating = 3; break;
          case "2-below-expectations": rating = 2; break;
          case "1-significantly-below-expectations": rating = 1; break;
        }
        totalScore += (rating * assessment.weight) / 100;
        totalWeight += assessment.weight;
      }
    });
    
    return totalWeight > 0 ? (totalScore * 100 / totalWeight).toFixed(1) : "0.0";
  };

  // Calculate behavioural section score
  const calculateBehaviouralSectionScore = () => {
    const assessments = form.watch("behaviouralAssessments");
    let totalScore = 0;
    let totalWeight = 0;
    
    assessments.forEach(assessment => {
      if (assessment.effectiveness && assessment.weight) {
        let rating = 0;
        switch (assessment.effectiveness) {
          case "5-exceeds-expectations": rating = 5; break;
          case "4-meets-expectations": rating = 4; break;
          case "3-somewhat-meets-expectations": rating = 3; break;
          case "2-below-expectations": rating = 2; break;
          case "1-significantly-below-expectations": rating = 1; break;
        }
        totalScore += (rating * assessment.weight) / 100;
        totalWeight += assessment.weight;
      }
    });
    
    return totalWeight > 0 ? (totalScore * 100 / totalWeight).toFixed(1) : "0.0";
  };

  // Training Needs management functions
  const addTrainingNeed = (type: 'database' | 'new') => {
    const newTrainingNeed = {
      id: Date.now().toString(),
      training: "",
      comment: "",
    };
    const currentTrainingNeeds = form.getValues("trainingNeeds");
    form.setValue("trainingNeeds", [...currentTrainingNeeds, newTrainingNeed]);
  };

  const deleteTrainingNeed = (id: string) => {
    const currentTrainingNeeds = form.getValues("trainingNeeds");
    form.setValue("trainingNeeds", currentTrainingNeeds.filter(t => t.id !== id));
    setTrainingNeedsComments(prev => {
      const newComments = { ...prev };
      delete newComments[id];
      return newComments;
    });
  };

  const updateTrainingNeed = (id: string, field: string, value: string) => {
    const currentTrainingNeeds = form.getValues("trainingNeeds");
    const updatedTrainingNeeds = currentTrainingNeeds.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    );
    form.setValue("trainingNeeds", updatedTrainingNeeds);
  };

  // Calculate overall score (F1)
  const calculateOverallScore = () => {
    const competenceScore = parseFloat(calculateSectionScore());
    const behaviouralScore = parseFloat(calculateBehaviouralSectionScore());
    return ((competenceScore + behaviouralScore) / 2).toFixed(1);
  };

  // Recommendation management functions
  const updateRecommendation = (id: string, field: string, value: string) => {
    const currentRecommendations = form.getValues("recommendations");
    const updatedRecommendations = currentRecommendations.map(r => 
      r.id === id ? { ...r, [field]: value } : r
    );
    form.setValue("recommendations", updatedRecommendations);
  };

  // Appraiser Comments management
  const addAppraiserComment = (name: string, rank: string) => {
    const newComment = {
      id: Date.now().toString(),
      name,
      rank,
      comment: "",
    };
    const currentComments = form.getValues("appraiserComments");
    form.setValue("appraiserComments", [...currentComments, newComment]);
    setEditingAppraiserComment(newComment.id);
  };

  const updateAppraiserComment = (id: string, field: string, value: string) => {
    const currentComments = form.getValues("appraiserComments");
    const updatedComments = currentComments.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    );
    form.setValue("appraiserComments", updatedComments);
  };

  const deleteAppraiserComment = (id: string) => {
    const currentComments = form.getValues("appraiserComments");
    form.setValue("appraiserComments", currentComments.filter(c => c.id !== id));
  };

  // Seafarer Comments management
  const updateSeafarerComment = (id: string, field: string, value: string) => {
    const currentComments = form.getValues("seafarerComments");
    const updatedComments = currentComments.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    );
    form.setValue("seafarerComments", updatedComments);
  };

  // Office Review management
  const addOfficeReview = () => {
    const newReview = {
      id: Date.now().toString(),
      name: "",
      position: "",
      feedback: "",
    };
    const currentReviews = form.getValues("officeReviews");
    form.setValue("officeReviews", [...currentReviews, newReview]);
    setEditingOfficeReview(newReview.id);
  };

  const updateOfficeReview = (id: string, field: string, value: string) => {
    const currentReviews = form.getValues("officeReviews");
    const updatedReviews = currentReviews.map(r => 
      r.id === id ? { ...r, [field]: value } : r
    );
    form.setValue("officeReviews", updatedReviews);
  };

  const deleteOfficeReview = (id: string) => {
    const currentReviews = form.getValues("officeReviews");
    form.setValue("officeReviews", currentReviews.filter(r => r.id !== id));
  };

  // Training Followup management
  const addTrainingFollowup = (type: 'database' | 'new') => {
    const newFollowup = {
      id: Date.now().toString(),
      training: "",
      correspondingInDB: "Select Training from DB",
      category: "Select Rating",
      status: "Proposed" as const,
      targetDate: "",
      comment: "",
    };
    const currentFollowups = form.getValues("trainingFollowups");
    form.setValue("trainingFollowups", [...currentFollowups, newFollowup]);
  };

  const updateTrainingFollowup = (id: string, field: string, value: string) => {
    const currentFollowups = form.getValues("trainingFollowups");
    const updatedFollowups = currentFollowups.map(f => 
      f.id === id ? { ...f, [field]: value } : f
    );
    form.setValue("trainingFollowups", updatedFollowups);
  };

  const deleteTrainingFollowup = (id: string) => {
    const currentFollowups = form.getValues("trainingFollowups");
    form.setValue("trainingFollowups", currentFollowups.filter(f => f.id !== id));
  };

  const RatingRadioGroup = ({ name, label }: { name: string; label: string }) => (
    <FormField
      control={form.control}
      name={name as any}
      render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between space-y-0 py-2">
          <FormLabel className="text-sm font-normal w-1/2">{label}</FormLabel>
          <FormControl>
            <RadioGroup
              onValueChange={field.onChange}
              value={field.value}
              className="flex flex-row space-x-4"
            >
              {[1, 2, 3, 4, 5].map((rating) => (
                <div key={rating} className="flex items-center space-x-2">
                  <RadioGroupItem value={rating.toString()} id={`${name}-${rating}`} />
                  <Label htmlFor={`${name}-${rating}`} className="text-xs">{rating}</Label>
                </div>
              ))}
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const sections = [
    { id: "reference", title: "Part A: Seafarer's Information" },
    { id: "information", title: "Part B: Information at Start of Appraisal Period" },
    { id: "competenceAssessment", title: "Part C: Competence Assessment (Professional Knowledge & Skills)" },
    { id: "behaviouralAssessment", title: "Part D: Behavioural Assessment (Soft Skills)" },
    { id: "trainingNeeds", title: "Part E: Training Needs & Development" },
    { id: "summary", title: "Part F: Summary & Recommendations" },
    { id: "officeReview", title: "Part G: Office Review & Followup" },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-3 sm:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg sm:text-xl font-bold">Crew Appraisal Form</h1>
          </div>
          <div className="flex gap-1 sm:gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => form.handleSubmit(onSubmit)()}
              className="items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 text-primary-foreground shadow hover:bg-primary/90 h-8 rounded-md px-3 text-xs hidden sm:flex bg-[#5fa5fa]"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => form.handleSubmit(onSubmit)()}
              className="sm:hidden"
            >
              <Save className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row">
          {/* Mobile Navigation Dropdown */}
          <div className="lg:hidden bg-gray-50 border-b p-3">
            <select
              value={activeSection}
              onChange={(e) => setActiveSection(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white"
            >
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
          </div>

          {/* Desktop Sidebar Navigation - Stepper Design */}
          <div className="hidden lg:block w-72 bg-[#f8fafc]">
            <div className="p-6">
              <nav className="space-y-1">
                {sections.map((section, index) => {
                  const isActive = activeSection === section.id;
                  const isCompleted = false; // You can add completion logic here
                  const sectionLetter = section.id === "reference" ? "A" : 
                                       section.id === "information" ? "B" :
                                       section.id === "competenceAssessment" ? "C" :
                                       section.id === "behaviouralAssessment" ? "D" :
                                       section.id === "trainingNeeds" ? "E" :
                                       section.id === "summary" ? "F" :
                                       section.id === "officeReview" ? "G" : section.id.charAt(0).toUpperCase();
                  
                  return (
                    <div key={section.id} className="relative">
                      <button
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full flex items-center p-3 rounded-lg text-left transition-colors hover:bg-gray-50 ${
                          isActive ? "bg-blue-50" : ""
                        }`}
                      >
                        <div 
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold mr-4 ${
                            isActive ? "bg-blue-600" : isCompleted ? "bg-green-500" : "bg-gray-400"
                          }`}
                        >
                          {sectionLetter}
                        </div>
                        <div className="flex-1">
                          <div className={`font-medium text-sm ${isActive ? "text-blue-700" : "text-gray-700"}`}>
                            {section.title.replace("Part A: ", "").replace("Part B: ", "").replace("Part C: ", "").replace("Part D: ", "").replace("Part E: ", "").replace("Part F: ", "").replace("Part G: ", "")}
                          </div>
                        </div>
                      </button>
                      {index < sections.length - 1 && (
                        <div className="absolute left-[2rem] top-16 w-0.5 h-4 bg-gray-300"></div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Form Content */}
          <div className="flex-1 p-3 sm:p-4 lg:p-6 bg-[#f8fafc]">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
                
                {/* Part A: Seafarer's Information */}
                {activeSection === "reference" && (
                  <Card className="bg-white">
                    <CardContent className="p-6">
                      <div className="pb-4 mb-6">
                        <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part A: Seafarer's Information</h3>
                        <div style={{ color: '#16569e' }} className="text-sm">Enter details as applicable</div>
                        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
                      </div>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="seafarersName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Seafarer's Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Enter seafarer's name" className="bg-gray-50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="seafarersRank"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Seafarer's Rank</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-gray-50">
                                    <SelectValue placeholder="Select rank" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="master">Master</SelectItem>
                                  <SelectItem value="chief-engineer">Chief Engineer</SelectItem>
                                  <SelectItem value="chief-mate">Chief Mate</SelectItem>
                                  <SelectItem value="second-officer">Second Officer</SelectItem>
                                  <SelectItem value="third-engineer">Third Engineer</SelectItem>
                                  <SelectItem value="able-seaman">Able Seaman</SelectItem>
                                  <SelectItem value="electrician">Electrician</SelectItem>
                                  <SelectItem value="bosun">Bosun</SelectItem>
                                  <SelectItem value="cook">Cook</SelectItem>
                                  <SelectItem value="steward">Steward</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="nationality"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Nationality</FormLabel>
                              <Popover open={nationalityOpen} onOpenChange={setNationalityOpen}>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      aria-expanded={nationalityOpen}
                                      className={cn(
                                        "w-full justify-between bg-gray-50 border-gray-200 hover:bg-gray-100",
                                        !field.value && "text-muted-foreground"
                                      )}
                                    >
                                      {field.value
                                        ? NATIONALITIES.find(
                                            (nationality) => nationality.toLowerCase() === field.value.toLowerCase()
                                          )
                                        : "Select nationality..."}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0">
                                  <Command>
                                    <CommandInput placeholder="Search nationality..." />
                                    <CommandList>
                                      <CommandEmpty>No nationality found.</CommandEmpty>
                                      <CommandGroup>
                                        {NATIONALITIES.map((nationality) => (
                                          <CommandItem
                                            key={nationality}
                                            value={nationality}
                                            onSelect={(currentValue) => {
                                              field.onChange(currentValue === field.value ? "" : currentValue);
                                              setNationalityOpen(false);
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                field.value?.toLowerCase() === nationality.toLowerCase()
                                                  ? "opacity-100"
                                                  : "opacity-0"
                                              )}
                                            />
                                            {nationality}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="vessel"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Vessel</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-gray-50">
                                    <SelectValue placeholder="Select vessel" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="mt-sail-one">MT Sail One</SelectItem>
                                  <SelectItem value="mt-sail-two">MT Sail Two</SelectItem>
                                  <SelectItem value="mt-sail-three">MT Sail Three</SelectItem>
                                  <SelectItem value="mt-sail-four">MT Sail Four</SelectItem>
                                  <SelectItem value="mt-sail-five">MT Sail Five</SelectItem>
                                  <SelectItem value="mt-sail-ten">MT Sail Ten</SelectItem>
                                  <SelectItem value="mt-sail-eight">MT Sail Eight</SelectItem>
                                  <SelectItem value="mt-sail-eleven">MT Sail Eleven</SelectItem>
                                  <SelectItem value="mt-sail-thirteen">MT Sail Thirteen</SelectItem>
                                  <SelectItem value="mv-sail-seven">MV Sail Seven</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="signOn"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Sign On Date</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="dd/mm/yyyy" type="date" className="bg-gray-50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="appraisalType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Appraisal Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-gray-50">
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="end-of-contract">End of Contract</SelectItem>
                                  <SelectItem value="mid-term">Mid Term</SelectItem>
                                  <SelectItem value="special">Special</SelectItem>
                                  <SelectItem value="probation">Probation</SelectItem>
                                  <SelectItem value="appraiser-s-off">Appraiser S/Off</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="appraisalPeriodFrom"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Appraisal Period From</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="dd.mm.yyyy" type="date" className="bg-gray-50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="appraisalPeriodTo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Appraisal Period To</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="dd.mm.yyyy" type="date" className="bg-gray-50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="primaryAppraiser"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Primary Appraiser</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-gray-50">
                                    <SelectValue placeholder="Select appraiser" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="captain">Captain</SelectItem>
                                  <SelectItem value="chief-engineer">Chief Engineer</SelectItem>
                                  <SelectItem value="chief-mate">Chief Mate</SelectItem>
                                  <SelectItem value="shore-management">Shore Management</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="personalityIndexCategory"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-gray-500 tracking-wide">Personality Index (PI) Category</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-gray-50">
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="dominance">Dominance</SelectItem>
                                  <SelectItem value="influence">Influence</SelectItem>
                                  <SelectItem value="steadiness">Steadiness</SelectItem>
                                  <SelectItem value="compliance">Compliance</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-end mt-6">
                        <Button className="bg-[#60A5FA] hover:bg-[#3B82F6] text-white px-8">
                          Save
                        </Button>
                      </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Part B: Information at Start of Appraisal Period */}
                {activeSection === "information" && (
                  <Card className="bg-white">
                    <CardContent className="p-6">
                      <div className="pb-4 mb-6">
                        <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part B: Information at Start of Appraisal Period</h3>
                        <div style={{ color: '#16569e' }} className="text-sm">Add below at the start of the Appraisal Period except the Evaluation which must be completed at the end of the Appraisal Period</div>
                        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
                      </div>
                      <div className="space-y-8">
                      {/* B1. Trainings conducted prior joining vessel */}
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-medium" style={{ color: '#16569e' }}>B1. Trainings conducted prior joining vessel (To Assess Effectiveness)</h3>
                          <Button
                            type="button"
                            onClick={addTraining}
                            variant="outline"
                            size="sm"
                            className="text-gray-600 border-gray-300"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Training
                          </Button>
                        </div>
                        
                        <div className="border rounded-lg overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[600px]">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-medium text-gray-600">S.No</th>
                                  <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-medium text-gray-600">Training</th>
                                  <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-medium text-gray-600">Evaluation</th>
                                  <th className="text-left p-2 sm:p-3 text-xs sm:text-sm font-medium text-gray-600">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                              {form.watch("trainings").map((training, index) => (
                                <React.Fragment key={training.id}>
                                  <tr className="border-t">
                                    <td className="p-3 text-sm">{index + 1}.</td>
                                    <td className="p-3">
                                      <Input
                                        value={training.training}
                                        onChange={(e) => updateTraining(training.id, "training", e.target.value)}
                                        placeholder={`Training ${index + 1}`}
                                        className="border-0 bg-transparent p-0 focus-visible:ring-0"
                                      />
                                    </td>
                                    <td className="p-3">
                                      <Select
                                        value={training.evaluation}
                                        onValueChange={(value) => updateTraining(training.id, "evaluation", value)}
                                      >
                                        <SelectTrigger className="border-0 bg-transparent p-0 focus-visible:ring-0">
                                          <SelectValue placeholder="Select Rating" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="5-exceeded-expectations">5- Exceeded Expectations</SelectItem>
                                          <SelectItem value="4-meets-expectations">4- Meets Expectations</SelectItem>
                                          <SelectItem value="3-somewhat-meets-expectations">3- Somewhat Meets Expectations</SelectItem>
                                          <SelectItem value="2-below-expectations">2- Below Expectations</SelectItem>
                                          <SelectItem value="1-significantly-below-expectations">1- Significantly Below Expectations</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </td>
                                    <td className="p-3">
                                      <div className="flex space-x-2">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setTrainingComments(prev => ({
                                            ...prev,
                                            [training.id]: prev[training.id] || ""
                                          }))}
                                        >
                                          <MessageSquare className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setEditingTraining(training.id)}
                                        >
                                          <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => deleteTraining(training.id)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                  {trainingComments[training.id] !== undefined && (
                                    <tr>
                                      <td></td>
                                      <td colSpan={3} className="p-3">
                                        <Textarea
                                          value={trainingComments[training.id]}
                                          onChange={(e) => {
                                            setTrainingComments(prev => ({
                                              ...prev,
                                              [training.id]: e.target.value
                                            }));
                                            updateTraining(training.id, "comment", e.target.value);
                                          }}
                                          placeholder="Comment: Add your observations here..."
                                          className="text-blue-600 italic border-blue-200"
                                          rows={2}
                                        />
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              ))}
                              {form.watch("trainings").length === 0 && (
                                <tr>
                                  <td colSpan={4} className="p-8 text-center text-gray-500">
                                    No trainings added yet. Click "Add Training" to get started.
                                  </td>
                                </tr>
                              )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {/* B2. Target Setting */}
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-medium text-blue-700">B2. Target Setting</h3>
                          <Button
                            type="button"
                            onClick={addTarget}
                            variant="outline"
                            size="sm"
                            className="text-gray-600 border-gray-300"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Target
                          </Button>
                        </div>
                        
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="text-left p-3 text-sm font-medium text-gray-600">S.No</th>
                                <th className="text-left p-3 text-sm font-medium text-gray-600">Target Setting</th>
                                <th className="text-left p-3 text-sm font-medium text-gray-600">Evaluation</th>
                                <th className="text-left p-3 text-sm font-medium text-gray-600">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {form.watch("targets").map((target, index) => (
                                <React.Fragment key={target.id}>
                                  <tr className="border-t">
                                    <td className="p-3 text-sm">{index + 1}.</td>
                                    <td className="p-3">
                                      <Input
                                        value={target.targetSetting}
                                        onChange={(e) => updateTarget(target.id, "targetSetting", e.target.value)}
                                        placeholder={`Target ${index + 1}`}
                                        className="border-0 bg-transparent p-0 focus-visible:ring-0"
                                      />
                                    </td>
                                    <td className="p-3">
                                      <Select
                                        value={target.evaluation}
                                        onValueChange={(value) => updateTarget(target.id, "evaluation", value)}
                                      >
                                        <SelectTrigger className="border-0 bg-transparent p-0 focus-visible:ring-0">
                                          <SelectValue placeholder="Select Rating" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="5-exceeded-set-target">5- Exceeded Set Target</SelectItem>
                                          <SelectItem value="4-fully-met-target">4- Fully Met Target</SelectItem>
                                          <SelectItem value="3-missed-target-small-margin">3- Missed Target by a Small Margin</SelectItem>
                                          <SelectItem value="2-missed-target-significant-margin">2- Missed Target by a Significant Margin</SelectItem>
                                          <SelectItem value="1-failed-to-achieve-target">1- Failed to Achieve Target</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </td>
                                    <td className="p-3">
                                      <div className="flex space-x-2">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setTargetComments(prev => ({
                                            ...prev,
                                            [target.id]: prev[target.id] || ""
                                          }))}
                                        >
                                          <MessageSquare className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setEditingTarget(target.id)}
                                        >
                                          <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => deleteTarget(target.id)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                  {targetComments[target.id] !== undefined && (
                                    <tr>
                                      <td></td>
                                      <td colSpan={3} className="p-3">
                                        <Textarea
                                          value={targetComments[target.id]}
                                          onChange={(e) => {
                                            setTargetComments(prev => ({
                                              ...prev,
                                              [target.id]: e.target.value
                                            }));
                                            updateTarget(target.id, "comment", e.target.value);
                                          }}
                                          placeholder="Comment: Add your observations here..."
                                          className="text-blue-600 italic border-blue-200"
                                          rows={2}
                                        />
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              ))}
                              {form.watch("targets").length === 0 && (
                                <tr>
                                  <td colSpan={4} className="p-8 text-center text-gray-500">
                                    No targets added yet. Click "Add Target" to get started.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="flex justify-end gap-4 mt-6">
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8">
                          Save
                        </Button>
                        <Button className="bg-[#20c43f] hover:bg-[#1ba838] text-white px-8">
                          Submit
                        </Button>
                      </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Part C: Competence Assessment */}
                {activeSection === "competenceAssessment" && (
                  <Card className="bg-white">
                    <CardContent className="p-6">
                      <div className="pb-4 mb-6">
                        <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part C: Competence Assessment (Professional Knowledge & Skills)</h3>
                        <div style={{ color: '#16569e' }} className="text-sm">Description</div>
                        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
                      </div>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="text-left p-3 text-sm font-medium text-gray-600">S.No</th>
                              <th className="text-left p-3 text-sm font-medium text-gray-600">Assessment Criteria</th>
                              <th className="text-left p-3 text-sm font-medium text-gray-600">Weight %</th>
                              <th className="text-left p-3 text-sm font-medium text-gray-600">Effectiveness</th>
                              <th className="text-left p-3 text-sm font-medium text-gray-600">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {form.watch("competenceAssessments").map((assessment, index) => (
                              <React.Fragment key={assessment.id}>
                                <tr className="border-t">
                                  <td className="p-3 text-sm">{index + 1}.</td>
                                  <td className="p-3 text-sm">{assessment.assessmentCriteria}</td>
                                  <td className="p-3 text-sm">{assessment.weight}%</td>
                                  <td className="p-3">
                                    <Select
                                      value={assessment.effectiveness}
                                      onValueChange={(value) => updateCompetenceAssessment(assessment.id, "effectiveness", value)}
                                    >
                                      <SelectTrigger className="border-0 bg-transparent p-0 focus-visible:ring-0">
                                        <SelectValue placeholder="Select Rating" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="5-exceeds-expectations">5- Exceeds Expectations</SelectItem>
                                        <SelectItem value="4-meets-expectations">4- Meets Expectations</SelectItem>
                                        <SelectItem value="3-somewhat-meets-expectations">3- Somewhat Meets Expectations</SelectItem>
                                        <SelectItem value="2-below-expectations">2- Below Expectations</SelectItem>
                                        <SelectItem value="1-significantly-below-expectations">1- Significantly Below Expectations</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="p-3">
                                    <div className="flex space-x-2">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setCompetenceComments(prev => ({
                                          ...prev,
                                          [assessment.id]: prev[assessment.id] || ""
                                        }))}
                                      >
                                        <MessageSquare className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                                {competenceComments[assessment.id] !== undefined && (
                                  <tr>
                                    <td></td>
                                    <td colSpan={4} className="p-3">
                                      <Textarea
                                        value={competenceComments[assessment.id]}
                                        onChange={(e) => {
                                          setCompetenceComments(prev => ({
                                            ...prev,
                                            [assessment.id]: e.target.value
                                          }));
                                          updateCompetenceAssessment(assessment.id, "comment", e.target.value);
                                        }}
                                        placeholder="Comment: Add your observations here..."
                                        className="text-blue-600 italic border-blue-200"
                                        rows={2}
                                      />
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Section Score */}
                      <div className="flex justify-between items-center mt-6 p-4 bg-gray-50 rounded-lg">
                        <div className="text-sm font-medium text-gray-700">Section Score:</div>
                        <div className={`px-4 py-2 rounded text-lg font-semibold min-w-[64px] text-center ${getScoreColors(parseFloat(calculateSectionScore())).bgColor} ${getScoreColors(parseFloat(calculateSectionScore())).textColor}`}>
                          {calculateSectionScore()}
                        </div>
                      </div>

                      <div className="flex justify-end mt-6">
                        <Button className="bg-[#60A5FA] hover:bg-[#3B82F6] text-white px-8">
                          Save
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Part D: Behavioural Assessment */}
                {activeSection === "behaviouralAssessment" && (
                  <Card className="bg-white">
                    <CardContent className="p-6">
                      <div className="pb-4 mb-6">
                        <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part D: Behavioural Assessment (Soft Skills)</h3>
                        <div style={{ color: '#16569e' }} className="text-sm">Description</div>
                        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
                      </div>
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-gray-600 border-gray-300"
                          >
                            + Add Criterion
                          </Button>
                        </div>
                      </div>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="text-left p-3 text-sm font-medium text-gray-600">S.No</th>
                              <th className="text-left p-3 text-sm font-medium text-gray-600">Assessment Criteria</th>
                              <th className="text-left p-3 text-sm font-medium text-gray-600">Weight %</th>
                              <th className="text-left p-3 text-sm font-medium text-gray-600">Effectiveness</th>
                              <th className="text-left p-3 text-sm font-medium text-gray-600">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                          {form.watch("behaviouralAssessments").map((assessment, index) => (
                            <React.Fragment key={assessment.id}>
                              <tr className="border-t">
                                <td className="p-3 text-sm">{index + 1}.</td>
                                <td className="p-3 text-sm">{assessment.assessmentCriteria}</td>
                                <td className="p-3 text-sm text-center">{assessment.weight}%</td>
                                <td className="p-3">
                                  <Select
                                    value={assessment.effectiveness}
                                    onValueChange={(value) => updateBehaviouralAssessment(assessment.id, "effectiveness", value)}
                                  >
                                    <SelectTrigger className="border-0 bg-transparent p-0 focus-visible:ring-0">
                                      <SelectValue placeholder="Select Rating" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="5-exceeds-expectations">5- Exceeds Expectations</SelectItem>
                                      <SelectItem value="4-meets-expectations">4- Meets Expectations</SelectItem>
                                      <SelectItem value="3-somewhat-meets-expectations">3- Somewhat Meets Expectations</SelectItem>
                                      <SelectItem value="2-below-expectations">2- Below Expectations</SelectItem>
                                      <SelectItem value="1-significantly-below-expectations">1- Significantly Below Expectations</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="p-3">
                                  <div className="flex space-x-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setBehaviouralComments(prev => ({
                                        ...prev,
                                        [assessment.id]: prev[assessment.id] || ""
                                      }))}
                                    >
                                      <MessageSquare className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                              {behaviouralComments[assessment.id] !== undefined && (
                                <tr>
                                  <td></td>
                                  <td colSpan={4} className="p-3">
                                    <Textarea
                                      value={behaviouralComments[assessment.id]}
                                      onChange={(e) => {
                                        setBehaviouralComments(prev => ({
                                          ...prev,
                                          [assessment.id]: e.target.value
                                        }));
                                        updateBehaviouralAssessment(assessment.id, "comment", e.target.value);
                                      }}
                                      placeholder="Comment: Add your observations here..."
                                      className="text-blue-600 italic border-blue-200"
                                      rows={2}
                                    />
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex justify-between items-center mt-6 p-4 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-600">Section Score:</span>
                        <div className={`px-4 py-2 rounded text-lg font-semibold min-w-[64px] text-center ${getScoreColors(parseFloat(calculateBehaviouralSectionScore())).bgColor} ${getScoreColors(parseFloat(calculateBehaviouralSectionScore())).textColor}`}>
                          {calculateBehaviouralSectionScore()}
                        </div>
                      </div>

                      <div className="flex justify-end mt-6">
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8">
                          Save
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Part E: Training Needs & Development */}
                {activeSection === "trainingNeeds" && (
                  <Card className="bg-white">
                    <CardContent className="p-6">
                      <div className="pb-4 mb-6">
                        <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part E Training Needs & Development</h3>
                        <div style={{ color: '#16569e' }} className="text-sm">Specify any training needs identified during the appraisals period</div>
                        <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
                      </div>
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-gray-600 border-gray-300"
                              onClick={() => addTrainingNeed('database')}
                            >
                              + Add Training from Database
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-gray-600 border-gray-300"
                              onClick={() => addTrainingNeed('new')}
                            >
                              + Add New Training
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="text-left p-3 text-sm font-medium text-gray-600">S.No</th>
                              <th className="text-left p-3 text-sm font-medium text-gray-600">Training</th>
                              <th className="text-left p-3 text-sm font-medium text-gray-600">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                          {form.watch("trainingNeeds").map((trainingNeed, index) => (
                            <React.Fragment key={trainingNeed.id}>
                              <tr className="border-t">
                                <td className="p-3 text-sm">{index + 1}.</td>
                                <td className="p-3">
                                  <Input
                                    value={trainingNeed.training}
                                    onChange={(e) => updateTrainingNeed(trainingNeed.id, "training", e.target.value)}
                                    placeholder={`Training ${index + 1}`}
                                    className="border-0 bg-transparent p-0 focus-visible:ring-0"
                                  />
                                </td>
                                <td className="p-3">
                                  <div className="flex space-x-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setTrainingNeedsComments(prev => ({
                                        ...prev,
                                        [trainingNeed.id]: prev[trainingNeed.id] || ""
                                      }))}
                                    >
                                      <MessageSquare className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteTrainingNeed(trainingNeed.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                              {trainingNeedsComments[trainingNeed.id] !== undefined && (
                                <tr>
                                  <td></td>
                                  <td colSpan={2} className="p-3">
                                    <Textarea
                                      value={trainingNeedsComments[trainingNeed.id]}
                                      onChange={(e) => {
                                        setTrainingNeedsComments(prev => ({
                                          ...prev,
                                          [trainingNeed.id]: e.target.value
                                        }));
                                        updateTrainingNeed(trainingNeed.id, "comment", e.target.value);
                                      }}
                                      placeholder="Comment: Add your observations here..."
                                      className="text-blue-600 italic border-blue-200"
                                      rows={2}
                                    />
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                          {form.watch("trainingNeeds").length === 0 && (
                            <tr>
                              <td colSpan={3} className="p-8 text-center text-gray-500">
                                No training needs added yet. Click "Add Training from Database" or "Add New Training" to get started.
                              </td>
                            </tr>
                          )}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex justify-end mt-6">
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8">
                          Save
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Part F: Comments & Recommendations */}
                {activeSection === "summary" && (
                  <div className="space-y-6">
                    <Card className="bg-white">
                      <CardContent className="p-6">
                        <div className="pb-4 mb-6">
                          <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part F Comments & Recommendations</h3>
                          <div style={{ color: '#16569e' }} className="text-sm">Add any recommendations related to following</div>
                          <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
                        </div>

                        {/* F1: Overall Score */}
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="text-lg font-semibold" style={{ color: '#16569e' }}>F1. Overall Score</h3>
                          <div className={`px-4 py-2 rounded text-lg font-bold min-w-[64px] text-center ${getScoreColors(parseFloat(calculateOverallScore())).bgColor} ${getScoreColors(parseFloat(calculateOverallScore())).textColor}`}>
                            {calculateOverallScore()}
                          </div>
                        </div>

                        {/* F2: Appraiser's Recommendations */}
                        <div className="space-y-4 mb-6">
                          <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold" style={{ color: '#16569e' }}>F2. Appraiser's Recommendations</h3>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-blue-600 border-blue-300"
                            >
                              + Add Recommendation
                            </Button>
                          </div>
                          <div className="border rounded-lg overflow-hidden">
                            <table className="w-full">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="text-left p-3 text-sm font-medium text-gray-600">S.No</th>
                                  <th className="text-left p-3 text-sm font-medium text-gray-600">Recommendations</th>
                                  <th className="text-center p-3 text-sm font-medium text-gray-600">Yes</th>
                                  <th className="text-center p-3 text-sm font-medium text-gray-600">No</th>
                                  <th className="text-center p-3 text-sm font-medium text-gray-600">NA</th>
                                  <th className="text-center p-3 text-sm font-medium text-gray-600">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {form.watch("recommendations").map((recommendation, index) => (
                                  <React.Fragment key={recommendation.id}>
                                    <tr className="border-t">
                                      <td className="p-3 text-sm">{index + 1}.</td>
                                      <td className="p-3 text-sm">{recommendation.question}</td>
                                      <td className="text-center p-3">
                                        <input
                                          type="radio"
                                          name={`recommendation-${recommendation.id}`}
                                          checked={recommendation.answer === "Yes"}
                                          onChange={() => updateRecommendation(recommendation.id, "answer", "Yes")}
                                          className="w-4 h-4"
                                        />
                                      </td>
                                      <td className="text-center p-3">
                                        <input
                                          type="radio"
                                          name={`recommendation-${recommendation.id}`}
                                          checked={recommendation.answer === "No"}
                                          onChange={() => updateRecommendation(recommendation.id, "answer", "No")}
                                          className="w-4 h-4"
                                        />
                                      </td>
                                      <td className="text-center p-3">
                                        <input
                                          type="radio"
                                          name={`recommendation-${recommendation.id}`}
                                          checked={recommendation.answer === "NA"}
                                          onChange={() => updateRecommendation(recommendation.id, "answer", "NA")}
                                          className="w-4 h-4"
                                        />
                                      </td>
                                      <td className="p-3">
                                        <div className="flex justify-center space-x-2">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setRecommendationComments(prev => ({
                                              ...prev,
                                              [recommendation.id]: prev[recommendation.id] || ""
                                            }))}
                                          >
                                            <MessageSquare className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                          >
                                            <Edit2 className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </td>
                                    </tr>
                                    {recommendationComments[recommendation.id] !== undefined && (
                                      <tr>
                                        <td></td>
                                        <td colSpan={5} className="p-3">
                                          <p className="text-blue-600 italic text-sm">
                                            Comment: Recommended as there seemed to be a large gap in officer's understanding.
                                          </p>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* F3: Appraiser Comments */}
                        <div className="space-y-4 mb-6">
                          <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold" style={{ color: '#16569e' }}>F3. Appraiser Comments</h3>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-gray-600 border-gray-300"
                              onClick={() => {
                                addAppraiserComment("Ashok Kumar", "Chief Officer");
                              }}
                            >
                              + Add Appraiser
                            </Button>
                          </div>
                          <div className="space-y-4">
                            {form.watch("appraiserComments").map((appraiser, index) => (
                              <div key={appraiser.id} className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="font-medium text-blue-600">
                                      {index === 0 ? form.watch("primaryAppraiser") || "Capt. John Leki, Master (Primary Appraiser)" : `${appraiser.name}, ${appraiser.rank}`}
                                    </p>
                                  </div>
                                  <div className="flex space-x-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEditingAppraiserComment(appraiser.id)}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    {index > 0 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => deleteAppraiserComment(appraiser.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                {editingAppraiserComment === appraiser.id ? (
                                  <Textarea
                                    value={appraiser.comment}
                                    onChange={(e) => updateAppraiserComment(appraiser.id, "comment", e.target.value)}
                                    onBlur={() => setEditingAppraiserComment(null)}
                                    placeholder="Add your comment here..."
                                    className="text-blue-600 italic"
                                    rows={3}
                                    autoFocus
                                  />
                                ) : (
                                  appraiser.comment && (
                                    <p className="text-blue-600 italic text-sm pl-4">
                                      {appraiser.comment || (index === 0 ? "Officer X has performed consistently throughout the contract and participated in upgradation of the XXX. The inspection performance has been satisfactory, no major findings received in 2 SIRE and 1 PSC inspections." : "Officer X has performed consistently throughout the contract and participated in upgradation of the XXX. The inspection performance has been satisfactory, no major findings received in 2 SIRE and 1 PSC inspections.")}
                                    </p>
                                  )
                                )}
                                {editingAppraiserComment !== appraiser.id && !appraiser.comment && (
                                  <div 
                                    className="border-2 border-dashed border-blue-200 p-3 rounded cursor-pointer hover:bg-blue-50"
                                    onClick={() => setEditingAppraiserComment(appraiser.id)}
                                  >
                                    <p className="text-gray-500 text-sm">Click to add comment...</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* F4: Seafarer Comments */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold" style={{ color: '#16569e' }}>F4. Seafarer Comments</h3>
                          <div className="space-y-4">
                            {form.watch("seafarerComments").map((seafarer, index) => (
                              <div key={seafarer.id} className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="font-medium text-blue-600">
                                      {`${form.watch("seafarersName") || "Derek Cole"}, ${form.watch("seafarersRank") || "3rd Officer"}`}
                                    </p>
                                  </div>
                                  <div className="flex space-x-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEditingSeafarerComment(seafarer.id)}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                {editingSeafarerComment === seafarer.id ? (
                                  <Textarea
                                    value={seafarer.comment}
                                    onChange={(e) => updateSeafarerComment(seafarer.id, "comment", e.target.value)}
                                    onBlur={() => setEditingSeafarerComment(null)}
                                    placeholder="Add your comment here..."
                                    className="text-blue-600 italic"
                                    rows={3}
                                    autoFocus
                                  />
                                ) : (
                                  seafarer.comment && (
                                    <p className="text-blue-600 italic text-sm pl-4">
                                      {seafarer.comment || "I have received a very good opportunity to learn effectively during my tenure on board. I was able to practically apply the skills I had gained to enhance the operational performance. I would like to return on this vessel."}
                                    </p>
                                  )
                                )}
                                {editingSeafarerComment !== seafarer.id && !seafarer.comment && (
                                  <div 
                                    className="border-2 border-dashed border-blue-200 p-3 rounded cursor-pointer hover:bg-blue-50"
                                    onClick={() => setEditingSeafarerComment(seafarer.id)}
                                  >
                                    <p className="text-gray-500 text-sm">Click to add comment...</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex justify-end gap-4 mt-6">
                          <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8">
                            Save
                          </Button>
                          <Button className="bg-[#20c43f] hover:bg-[#1ba838] text-white px-8">
                            Submit
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
                        {form.watch("appraiserComments").map((appraiser, index) => (
                          <div key={appraiser.id} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium text-blue-600">
                                  {index === 0 ? form.watch("primaryAppraiser") || "Capt. John Leki, Master (Primary Appraiser)" : `${appraiser.name}, ${appraiser.rank}`}
                                </p>
                              </div>
                              <div className="flex space-x-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingAppraiserComment(appraiser.id)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                {index > 0 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteAppraiserComment(appraiser.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            {editingAppraiserComment === appraiser.id ? (
                              <Textarea
                                value={appraiser.comment}
                                onChange={(e) => updateAppraiserComment(appraiser.id, "comment", e.target.value)}
                                onBlur={() => setEditingAppraiserComment(null)}
                                placeholder="Add your comment here..."
                                className="text-blue-600 italic"
                                rows={3}
                                autoFocus
                              />
                            ) : (
                              appraiser.comment && (
                                <p className="text-blue-600 italic text-sm pl-4">
                                  {appraiser.comment || (index === 0 ? "Officer X has performed consistently throughout the contract and participated in upgradation of the XXX. The inspection performance has been satisfactory, no major findings received in 2 SIRE and 1 PSC inspections." : "Officer X has performed consistently throughout the contract and participated in upgradation of the XXX. The inspection performance has been satisfactory, no major findings received in 2 SIRE and 1 PSC inspections.")}
                                </p>
                              )
                            )}
                            {editingAppraiserComment !== appraiser.id && !appraiser.comment && index === 0 && (
                              <div 
                                className="border-2 border-dashed border-blue-200 p-3 rounded cursor-pointer hover:bg-blue-50"
                                onClick={() => setEditingAppraiserComment(appraiser.id)}
                              >
                                <p className="text-gray-500 text-sm">Click to add comment...</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* F4: Seafarer's Comments */}
                    <Card className="bg-white">
                      <CardHeader>
                        <h3 className="text-lg font-semibold" style={{ color: '#16569e' }}>F4. Seafarer's Comments</h3>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {form.watch("seafarerComments").map((seafarer, index) => (
                          <div key={seafarer.id} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium text-blue-600">
                                  {`${form.watch("seafarersName") || "Derek Cole"}, ${form.watch("seafarersRank") || "3rd Officer"}`}
                                </p>
                              </div>
                              <div className="flex space-x-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingSeafarerComment(seafarer.id)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            {editingSeafarerComment === seafarer.id ? (
                              <Textarea
                                value={seafarer.comment}
                                onChange={(e) => updateSeafarerComment(seafarer.id, "comment", e.target.value)}
                                onBlur={() => setEditingSeafarerComment(null)}
                                placeholder="Add your comment here..."
                                className="text-blue-600 italic"
                                rows={3}
                                autoFocus
                              />
                            ) : (
                              seafarer.comment && (
                                <p className="text-blue-600 italic text-sm pl-4">
                                  {seafarer.comment || "I have received a very good opportunity to learn effectively during my tenure on board. I was able to practically apply the skills I had gained to enhance the operational performance. I would like to return on this vessel."}
                                </p>
                              )
                            )}
                            {editingSeafarerComment !== seafarer.id && !seafarer.comment && (
                              <div 
                                className="border-2 border-dashed border-blue-200 p-3 rounded cursor-pointer hover:bg-blue-50"
                                onClick={() => setEditingSeafarerComment(seafarer.id)}
                              >
                                <p className="text-gray-500 text-sm">Click to add comment...</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* Action buttons */}
                    <div className="flex justify-end gap-4 mt-6">
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8">
                        Save
                      </Button>
                      <Button className="bg-[#20c43f] hover:bg-[#1ba838] text-white px-8">
                        Submit
                      </Button>
                    </div>
                  </div>
                )}

                {/* Part G: Office Review & Followup */}
                {activeSection === "officeReview" && (
                  <div className="space-y-6">
                    <Card className="bg-white">
                      <CardContent className="p-6">
                        <div className="pb-4 mb-6">
                          <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part G Office Review & Followup</h3>
                          <div style={{ color: '#16569e' }} className="text-sm">This section is visible to office users only</div>
                          <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* G1: Office Review */}
                    <Card className="bg-white">
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-semibold text-blue-700">G1. Office Review</h3>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-gray-600 border-gray-300"
                            onClick={addOfficeReview}
                          >
                            + Add Reviewer
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {form.watch("officeReviews").map((review, index) => (
                          <div key={review.id} className="space-y-2">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium text-blue-600">
                                  {review.name}, <span className="font-normal italic">{review.position}:</span>
                                </p>
                                <p className="text-blue-600 italic text-sm mt-1">
                                  {review.feedback}
                                </p>
                              </div>
                              <div className="flex space-x-2 ml-4">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingOfficeReview(review.id)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteOfficeReview(review.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* G1: Training Followup */}
                    <Card>
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-semibold text-blue-700">G1. Training Followup</h3>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-gray-600 border-gray-300"
                              onClick={() => addTrainingFollowup('database')}
                            >
                              + Add Training from Database
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-gray-600 border-gray-300"
                              onClick={() => addTrainingFollowup('new')}
                            >
                              + Add New Training
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="text-left p-3 text-sm font-medium text-gray-600">S.No</th>
                                <th className="text-left p-3 text-sm font-medium text-gray-600">Training</th>
                                <th className="text-left p-3 text-sm font-medium text-gray-600">Corresponding in DB</th>
                                <th className="text-left p-3 text-sm font-medium text-gray-600">Category</th>
                                <th className="text-left p-3 text-sm font-medium text-gray-600">Status</th>
                                <th className="text-left p-3 text-sm font-medium text-gray-600">Target or Compl. Date</th>
                                <th className="text-center p-3 text-sm font-medium text-gray-600">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {form.watch("trainingFollowups").map((followup, index) => (
                                <React.Fragment key={followup.id}>
                                  <tr className="border-t">
                                    <td className="p-3 text-sm">{index + 1}.</td>
                                    <td className="p-3">
                                      <Input
                                        value={followup.training}
                                        onChange={(e) => updateTrainingFollowup(followup.id, "training", e.target.value)}
                                        className="border-0 bg-transparent p-0 focus-visible:ring-0"
                                      />
                                    </td>
                                    <td className="p-3">
                                      <select
                                        value={followup.correspondingInDB}
                                        onChange={(e) => updateTrainingFollowup(followup.id, "correspondingInDB", e.target.value)}
                                        className="w-full p-1 border rounded text-sm"
                                      >
                                        <option>Select Training from DB</option>
                                        <option>Training Option 1</option>
                                        <option>Training Option 2</option>
                                      </select>
                                    </td>
                                    <td className="p-3">
                                      <select
                                        value={followup.category}
                                        onChange={(e) => updateTrainingFollowup(followup.id, "category", e.target.value)}
                                        className="w-full p-1 border rounded text-sm"
                                      >
                                        <option>Select Rating</option>
                                        <option>1. Competence</option>
                                        <option>2- Soft Skills</option>
                                      </select>
                                    </td>
                                    <td className="p-3">
                                      <select
                                        value={followup.status}
                                        onChange={(e) => updateTrainingFollowup(followup.id, "status", e.target.value)}
                                        className={`w-full p-1 border rounded text-sm ${
                                          followup.status === "Proposed" ? "bg-gray-200" :
                                          followup.status === "Approved" ? "bg-blue-200" :
                                          followup.status === "Planned" ? "bg-yellow-200" :
                                          followup.status === "Declined" ? "bg-red-200" :
                                          followup.status === "Completed" ? "bg-green-200" : ""
                                        }`}
                                      >
                                        <option value="Proposed">Proposed</option>
                                        <option value="Approved">Approved</option>
                                        <option value="Planned">Planned</option>
                                        <option value="Declined">Declined</option>
                                        <option value="Completed">Completed</option>
                                      </select>
                                    </td>
                                    <td className="p-3">
                                      <Input
                                        type="date"
                                        value={followup.targetDate}
                                        onChange={(e) => updateTrainingFollowup(followup.id, "targetDate", e.target.value)}
                                        className="w-full"
                                      />
                                    </td>
                                    <td className="p-3">
                                      <div className="flex justify-center space-x-2">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                        >
                                          <MessageSquare className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                        >
                                          <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => deleteTrainingFollowup(followup.id)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                  {followup.comment && (
                                    <tr>
                                      <td></td>
                                      <td colSpan={6} className="p-3">
                                        <p className="text-blue-600 italic text-sm">
                                          Comment: {followup.comment}
                                        </p>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex justify-end gap-4 mt-6">
                          <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8">
                            Save
                          </Button>
                          <Button className="bg-[#20c43f] hover:bg-[#1ba838] text-white px-8">
                            Submit
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
};