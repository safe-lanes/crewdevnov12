import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Paperclip, MessageSquare, CheckCircle2, Loader2, Pencil } from 'lucide-react';
import { FileAttachmentDialog, type FileAttachment } from '@/components/FileAttachmentDialog';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { getCrewUserId } from '@/lib/crewUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import type { PromotionA2Config } from '@shared/schema';
import { calculateChecklistProgress } from './checklistProgressUtils';

interface PromotionData {
  crewMemberId: string;
  name: string;
  currentRank: string;
  promotionToRank: string;
  vesselLeave: string;
  dob: string;
  age: string;
  nationality?: string;
}

interface SeaServiceEntry {
  id?: string;
  vessel?: string;
  vesselName?: string;
  vesselType?: string;
  deadweight?: string | number;
  engineType?: string;
  enginePower?: string;
  engineTypePower?: string;
  isActive?: boolean;
  fromDate?: string;
  from?: string;
  toDate?: string;
  to?: string;
  period?: string;
  duration?: string;
  rank?: string;
}

interface ChecklistComment {
  id: string;
  userName: string;
  rank: string;
  text: string;
  date: string;
  verificationId?: string;
}

interface ChecklistVerification {
  id: string;
  verifierName: string;
  rank: string;
  date: string;
}

interface ChecklistAttachment {
  id: string;
  attUuid?: string;
  fileName: string;
  fileSize: number;
  uploadDate: string;
  type?: string;
  data?: string;
  uploadedAt?: string;
  filePath?: string;
  viewUrl?: string;
}

interface AssessmentPoint {
  id: string;
  number: string;
  text: string;
  completed: boolean;
  verifications: ChecklistVerification[];
  comments: ChecklistComment[];
  attachments: ChecklistAttachment[];
}

interface ChecklistSection {
  id: string;
  number: string;
  title: string;
  assessmentPoints: AssessmentPoint[];
}

interface PromotionChecklistFormProps {
  promotionData: PromotionData;
  onClose: () => void;
  checklistConfig?: PromotionA2Config | null;
  promotionReviewId?: number | null;
  promotionReviewUuid?: string | null;
  existingChecklistData?: string | null;
}

export const PromotionChecklistForm: React.FC<PromotionChecklistFormProps> = ({
  promotionData,
  onClose,
  checklistConfig,
  promotionReviewId,
  promotionReviewUuid,
  existingChecklistData,
}) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);

  const { data: dashboardData, isLoading: isLoadingCrew, error: crewError } = useQuery<any>({
    queryKey: [`/api/v2/crew-pool/crew/by-emp-no/${promotionData.crewMemberId}/dashboard`],
    enabled: !!promotionData.crewMemberId,
  });

  const seafarerData = {
    name: promotionData?.name || 'N/A',
    rank: promotionData?.currentRank || 'N/A',
    promotionRank: promotionData?.promotionToRank || 'N/A',
    vessel: promotionData?.vesselLeave || 'N/A',
    dateOfBirth: promotionData?.dob || 'N/A',
    age: promotionData?.age || 'N/A',
    nationality: promotionData?.nationality || 'N/A',
  };

  const seaServiceData = React.useMemo<SeaServiceEntry[]>(() => {
    if (!dashboardData?.seaService) return [];
    return Array.isArray(dashboardData.seaService) ? dashboardData.seaService : [];
  }, [dashboardData]);

  const storedDesignation = sessionStorage.getItem('crewDesignation');
  const [userName, setUserName] = React.useState<string>(() => {
    return sessionStorage.getItem('crewUserName') || '';
  });
  const [wasNameFromStorage] = React.useState<boolean>(() => {
    return !!sessionStorage.getItem('crewUserName');
  });
  
  const showNameInput = !wasNameFromStorage;
  
  const hasValidName = !!userName.trim();
  
  const getCurrentUser = React.useCallback(() => {
    return {
      name: userName.trim() || 'Unknown User',
      rank: storedDesignation || 'Unknown Position',
      role: 'Department Head'
    };
  }, [userName, storedDesignation]);
  
  const currentUser = getCurrentUser();
  
  const handleNameChange = (newName: string) => {
    setUserName(newName);
    const trimmedName = newName.trim();
    if (trimmedName) {
      sessionStorage.setItem('crewUserName', trimmedName);
      window.dispatchEvent(new CustomEvent('crewUserUpdated'));
    }
  };

  const parsedExistingData = React.useMemo((): ChecklistSection[] | null => {
    if (!existingChecklistData) return null;
    try {
      const parsed = typeof existingChecklistData === 'string' 
        ? JSON.parse(existingChecklistData) 
        : existingChecklistData;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.sections) {
        return Array.isArray(parsed.sections) ? parsed.sections : null;
      }
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      console.error('Failed to parse existing checklist data');
      return null;
    }
  }, [existingChecklistData]);

  const initializeSectionsFromConfig = React.useCallback((): ChecklistSection[] => {
    if (checklistConfig?.checklistSections?.length) {
      return checklistConfig.checklistSections.map((configSection) => {
        const savedSection = parsedExistingData?.find(s => s.id === configSection.id);
        
        return {
          id: configSection.id,
          number: configSection.id,
          title: configSection.title,
          assessmentPoints: configSection.assessmentPoints.map((configPoint) => {
            const savedPoint = savedSection?.assessmentPoints?.find(p => p.id === configPoint.id);
            const verifications = savedPoint?.verifications ?? [];
            const savedComments = savedPoint?.comments ?? [];

            let verifIdx = 0;
            const comments = savedComments.map((c) => {
              const isVerificationComment = (c.text ?? '') === '';
              if (!isVerificationComment) return c;
              if (c.verificationId) return c;
              const linked = verifications[verifIdx++];
              return linked ? { ...c, verificationId: linked.id } : c;
            });

            return {
              id: configPoint.id,
              number: configPoint.id,
              text: configPoint.text,
              completed: savedPoint?.completed ?? false,
              verifications,
              comments,
              attachments: savedPoint?.attachments ?? [],
            };
          }),
        };
      });
    }
    return [];
  }, [checklistConfig, parsedExistingData]);

  const [checklistSections, setChecklistSections] = React.useState<ChecklistSection[]>(initializeSectionsFromConfig);

  const checklistProgress = React.useMemo(() => {
    const requiredPerPoint = checklistConfig?.minChecklistVerifications ?? 0;
    const thresholdPercent = checklistConfig?.minChecklistCompletionPercent ?? 100;
    
    let totalPoints = 0;
    let completedVerifications = 0;
    
    checklistSections.forEach(section => {
      section.assessmentPoints.forEach(point => {
        totalPoints++;
        const pointVerifications = Math.min(point.verifications.length, requiredPerPoint);
        completedVerifications += pointVerifications;
      });
    });
    
    const totalRequired = totalPoints * requiredPerPoint;
    const percentage = totalRequired > 0 ? Math.round((completedVerifications / totalRequired) * 100) : 0;
    const meetsThreshold = percentage >= thresholdPercent;
    
    return {
      completedVerifications,
      totalRequired,
      percentage,
      thresholdPercent,
      meetsThreshold,
    };
  }, [checklistSections, checklistConfig?.minChecklistVerifications, checklistConfig?.minChecklistCompletionPercent]);

  const configIdRef = React.useRef<string | null>(null);
  const existingDataRef = React.useRef<string | null>(null);
  const currentConfigId = checklistConfig?.checklistSections?.map(s => s.id).join(',') ?? null;
  const currentExistingData = existingChecklistData ?? null;

  React.useEffect(() => {
    const configChanged = configIdRef.current !== currentConfigId;
    const existingDataChanged = existingDataRef.current !== currentExistingData;
    
    if (configChanged || existingDataChanged) {
      configIdRef.current = currentConfigId;
      existingDataRef.current = currentExistingData;
      const newSections = initializeSectionsFromConfig();
      setChecklistSections(newSections);
    }
  }, [currentConfigId, currentExistingData, initializeSectionsFromConfig]);

  const [activeCommentBox, setActiveCommentBox] = React.useState<string | null>(null);
  const [commentText, setCommentText] = React.useState<string>('');
  const [attachmentDialog, setAttachmentDialog] = React.useState<{ sectionId: string; pointId: string } | null>(null);
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(null);
  const [editCommentText, setEditCommentText] = React.useState<string>('');

  const handleSave = async () => {
    const reviewIdentifier = promotionReviewUuid || promotionReviewId;
    if (!reviewIdentifier) {
      toast({
        title: 'Cannot save',
        description: 'No promotion review ID found. Please save the promotion review form first.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSaving(true);
    try {
      const minVerifications = checklistConfig?.minChecklistVerifications ?? 1;
      const minCompletionPercent = checklistConfig?.minChecklistCompletionPercent ?? 100;
      const progressResult = calculateChecklistProgress(checklistSections, minVerifications, minCompletionPercent);
      
      const checklistProgressData = JSON.stringify({
        sections: checklistSections,
        progress: {
          percentage: progressResult.percentage,
          meetsThreshold: progressResult.meetsThreshold,
          completedVerifications: progressResult.completedVerifications,
          totalRequired: progressResult.totalRequired,
          thresholdPercent: minCompletionPercent,
          requiredPerPoint: minVerifications,
        }
      });
      
      await apiRequest('PATCH', `/api/v2/promotions/reviews/${reviewIdentifier}`, { checklistProgressData, auditUserUuid: getCrewUserId() });
      
      queryClient.invalidateQueries({ queryKey: ['/api/v2/promotions/reviews'] });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/v2/promotions/reviews/crew/${promotionData.crewMemberId}/rank/${encodeURIComponent(promotionData.promotionToRank)}`] 
      });
      
      toast({
        title: 'Saved successfully',
        description: 'Promotion checklist progress has been saved.',
      });
      
      onClose();
    } catch (error) {
      console.error('Failed to save checklist progress:', error);
      toast({
        title: 'Save failed',
        description: 'Failed to save checklist progress. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleComplete = (sectionId: string, pointId: string) => {
    const section = checklistSections.find(s => s.id === sectionId);
    const point = section?.assessmentPoints.find(p => p.id === pointId);
    
    if (point?.completed && point.verifications.length > 0) {
      toast({
        title: 'Cannot uncheck',
        description: 'Please cancel all verifications before unchecking this point.',
        variant: 'destructive',
      });
      return;
    }
    
    setChecklistSections(prev => prev.map(section => 
      section.id === sectionId 
        ? {
            ...section,
            assessmentPoints: section.assessmentPoints.map(point =>
              point.id === pointId
                ? { ...point, completed: !point.completed }
                : point
            )
          }
        : section
    ));
  };

  const toFileAttachment = (att: ChecklistAttachment): FileAttachment => ({
    id: att.id,
    name: att.fileName,
    type: att.type ?? '',
    size: att.fileSize,
    data: att.data ?? '',
    uploadedAt: att.uploadedAt ?? att.uploadDate ?? '',
    attUuid: att.attUuid,
    viewUrl: att.viewUrl,
    ...(att.filePath ? { filePath: att.filePath } : {}),
  } as FileAttachment);

  type FileAttachmentLike = FileAttachment & { uploadDate?: string };
  const toChecklistAttachment = (att: FileAttachmentLike): ChecklistAttachment => {
    const isoParsed = att.uploadedAt ? new Date(att.uploadedAt) : null;
    const isValidIso = !!isoParsed && !Number.isNaN(isoParsed.getTime()) && /\d{4}-\d{2}-\d{2}T/.test(att.uploadedAt ?? '');
    return {
      id: att.id,
      attUuid: (att as any).attUuid,
      fileName: att.name,
      fileSize: att.size,
      uploadDate: isValidIso
        ? (isoParsed as Date).toLocaleDateString()
        : (att.uploadDate ?? att.uploadedAt ?? new Date().toLocaleDateString()),
      type: att.type,
      data: att.data,
      uploadedAt: att.uploadedAt,
      filePath: (att as any).filePath,
      viewUrl: (att as any).viewUrl,
    };
  };

  const handleAttachmentsChange = (sectionId: string, pointId: string, next: FileAttachment[]) => {
    const mapped = next.filter(a => !a.isDeleted).map(toChecklistAttachment);
    setChecklistSections(prev => prev.map(section =>
      section.id === sectionId
        ? {
            ...section,
            assessmentPoints: section.assessmentPoints.map(point =>
              point.id === pointId ? { ...point, attachments: mapped } : point
            )
          }
        : section
    ));
  };

  const handleSaveEditedComment = (sectionId: string, pointId: string, commentId: string) => {
    const newText = editCommentText.trim();
    if (!newText) {
      setEditingCommentId(null);
      setEditCommentText('');
      return;
    }
    setChecklistSections(prev => prev.map(section =>
      section.id === sectionId
        ? {
            ...section,
            assessmentPoints: section.assessmentPoints.map(point =>
              point.id === pointId
                ? {
                    ...point,
                    comments: point.comments.map(c =>
                      c.id === commentId ? { ...c, text: newText } : c
                    )
                  }
                : point
            )
          }
        : section
    ));
    setEditingCommentId(null);
    setEditCommentText('');
  };

  const handleToggleCommentBox = (pointId: string) => {
    if (activeCommentBox === pointId) {
      setActiveCommentBox(null);
      setCommentText('');
    } else {
      setActiveCommentBox(pointId);
      setCommentText('');
    }
  };

  const handleAddComment = (sectionId: string, pointId: string) => {
    if (!commentText.trim()) return;

    const newComment: ChecklistComment = {
      id: `comment-${Date.now()}`,
      userName: currentUser.name,
      rank: currentUser.rank,
      text: commentText,
      date: new Date().toLocaleDateString()
    };

    setChecklistSections(prev => prev.map(section =>
      section.id === sectionId
        ? {
            ...section,
            assessmentPoints: section.assessmentPoints.map(point =>
              point.id === pointId
                ? { ...point, comments: [...point.comments, newComment] }
                : point
            )
          }
        : section
    ));

    setCommentText('');
    setActiveCommentBox(null);
  };

  const handleVerify = (sectionId: string, pointId: string) => {
    if (!hasValidName) {
      toast({
        title: 'Name required',
        description: 'Please enter your name in the Verifier Information section before verifying.',
        variant: 'destructive',
      });
      return;
    }
    
    const section = checklistSections.find(s => s.id === sectionId);
    const point = section?.assessmentPoints.find(p => p.id === pointId);
    
    if (!point?.completed) {
      toast({
        title: 'Not completed',
        description: 'Please mark this assessment point as completed before verifying.',
        variant: 'destructive',
      });
      return;
    }
    
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }).replace(/ /g, ' ');

    const verificationId = `verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newVerification: ChecklistVerification = {
      id: verificationId,
      verifierName: currentUser.name,
      rank: currentUser.rank,
      date: formattedDate
    };

    const verificationComment: ChecklistComment = {
      id: `vcomment-${verificationId}`,
      userName: currentUser.name,
      rank: currentUser.rank,
      text: '',
      date: formattedDate,
      verificationId,
    };

    setChecklistSections(prev => prev.map(section =>
      section.id === sectionId
        ? {
            ...section,
            assessmentPoints: section.assessmentPoints.map(point =>
              point.id === pointId
                ? {
                    ...point,
                    verifications: [...point.verifications, newVerification],
                    comments: [...point.comments, verificationComment]
                  }
                : point
            )
          }
        : section
    ));
  };
  
  const handleCancelVerification = (sectionId: string, pointId: string, verificationId: string) => {
    const section = checklistSections.find(s => s.id === sectionId);
    const point = section?.assessmentPoints.find(p => p.id === pointId);
    const verification = point?.verifications.find(v => v.id === verificationId);
    
    if (!verification) return;
    
    const currentUserName = currentUser.name.trim().toLowerCase();
    const verifierName = verification.verifierName.trim().toLowerCase();
    
    if (currentUserName !== verifierName) {
      toast({
        title: 'Cannot cancel',
        description: 'You can only cancel your own verifications.',
        variant: 'destructive',
      });
      return;
    }
    
    setChecklistSections(prev => prev.map(section =>
      section.id === sectionId
        ? {
            ...section,
            assessmentPoints: section.assessmentPoints.map(p =>
              p.id === pointId
                ? {
                    ...p,
                    verifications: p.verifications.filter(v => v.id !== verificationId),
                    comments: p.comments.filter(c => c.verificationId !== verificationId)
                  }
                : p
            )
          }
        : section
    ));
    
    toast({
      title: 'Verification cancelled',
      description: 'Your verification has been removed.',
    });
  };

  const handleDeleteComment = (sectionId: string, pointId: string, commentId: string) => {
    setChecklistSections(prev => prev.map(section =>
      section.id === sectionId
        ? {
            ...section,
            assessmentPoints: section.assessmentPoints.map(point =>
              point.id === pointId
                ? { ...point, comments: point.comments.filter(c => c.id !== commentId) }
                : point
            )
          }
        : section
    ));
  };

  const renderPartA = () => (
    <div className="space-y-4">
      <div className="border border-[#EAEBEF] rounded-lg p-4">
        <h3 className="text-base font-medium text-[#16569e] mb-4">A1. Seafarer's Information</h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <Label className="text-xs text-gray-500">Name</Label>
              <div className="text-sm font-medium mt-1" data-testid="text-seafarer-name">{seafarerData.name}</div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">DOB / Age</Label>
              <div className="text-sm font-medium mt-1" data-testid="text-dob-age">{seafarerData.dateOfBirth} / {seafarerData.age}</div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Nationality</Label>
              <div className="text-sm font-medium mt-1" data-testid="text-nationality">{seafarerData.nationality}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-6">
            <div>
              <Label className="text-xs text-gray-500">Present Rank</Label>
              <div className="text-sm font-medium mt-1" data-testid="text-present-rank">{seafarerData.rank}</div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Promotion to Rank</Label>
              <div className="text-sm font-medium mt-1" data-testid="text-promotion-rank">{seafarerData.promotionRank}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="border border-[#EAEBEF] rounded-lg p-4">
        <h3 className="text-base font-medium text-[#16569e] mb-4">A2. Details of Sea Service (in Current Rank in the Company)</h3>
        
        {isLoadingCrew ? (
          <div className="text-sm text-gray-500 py-4">Loading sea service data...</div>
        ) : crewError ? (
          <div className="text-sm text-red-500 py-4">Error loading sea service data</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-xs font-normal text-gray-500">Vessel Name</TableHead>
                  <TableHead className="text-xs font-normal text-gray-500">Vessel Type</TableHead>
                  <TableHead className="text-xs font-normal text-gray-500">Deadweight</TableHead>
                  <TableHead className="text-xs font-normal text-gray-500">Engine Type/ Power</TableHead>
                  <TableHead className="text-xs font-normal text-gray-500">From</TableHead>
                  <TableHead className="text-xs font-normal text-gray-500">To</TableHead>
                  <TableHead className="text-xs font-normal text-gray-500">Period(M)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seaServiceData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-sm text-gray-500 text-center py-4">
                      No sea service records found
                    </TableCell>
                  </TableRow>
                ) : (
                  seaServiceData.map((service: SeaServiceEntry, index: number) => (
                    <TableRow key={service.id || index}>
                      <TableCell className="text-sm" data-testid={`cell-vessel-name-${service.id || index}`}>{service.vessel || service.vesselName || 'N/A'}</TableCell>
                      <TableCell className="text-sm" data-testid={`cell-vessel-type-${service.id || index}`}>{service.vesselType || 'N/A'}</TableCell>
                      <TableCell className="text-sm" data-testid={`cell-deadweight-${service.id || index}`}>{service.deadweight || 'N/A'}</TableCell>
                      <TableCell className="text-sm normal-case" data-testid={`cell-engine-power-${service.id || index}`}>{service.engineTypePower || service.engineType || service.enginePower || 'N/A'}</TableCell>
                      <TableCell className="text-sm" data-testid={`cell-from-${service.id || index}`}>{service.fromDate || service.from || 'N/A'}</TableCell>
                      <TableCell className="text-sm" data-testid={`cell-to-${service.id || index}`}>{service.toDate || service.to || 'N/A'}</TableCell>
                      <TableCell className="text-sm" data-testid={`cell-period-${service.id || index}`}>{service.period || service.duration || 'N/A'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="border border-[#EAEBEF] rounded-lg p-4">
        <h3 className="text-base font-medium text-[#16569e] mb-4">A3. Checklist Progress</h3>
        
        <div className="space-y-3">
          <div className="text-sm text-gray-600 mb-3">
            Note: No of verifications required for each question: <span className="text-green-600 font-medium">{checklistConfig?.minChecklistVerifications ?? 'N/A'}</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full ${checklistProgress.meetsThreshold ? 'bg-green-500' : 'bg-[#EAB308]'}`}
                  style={{ width: `${checklistProgress.percentage}%` }}
                  data-testid="progress-bar-fill"
                ></div>
              </div>
            </div>
            <div className="text-sm font-medium text-gray-700 whitespace-nowrap" data-testid="progress-status-text">
              {checklistProgress.percentage}% ({checklistProgress.completedVerifications}/{checklistProgress.totalRequired} Verifications)
            </div>
          </div>
        </div>
      </div>

      {showNameInput && (
        <div className={`border border-[#EAEBEF] rounded-lg p-4 ${hasValidName ? 'bg-green-50 dark:bg-green-950/20' : 'bg-amber-50 dark:bg-amber-950/20'}`}>
          <h3 className="text-base font-medium text-[#16569e] mb-4">A4. Verifier Information</h3>
          
          <div className="space-y-3">
            <div className="text-sm text-gray-600 mb-2">
              {hasValidName 
                ? 'Your name has been saved. You can edit it if needed.'
                : 'Your name was not found in the system. Please enter your name below for verification records.'}
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-xs text-gray-500">Your Name <span className="text-red-500">*</span></Label>
                <Input
                  value={userName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Enter your name"
                  className="mt-1"
                  data-testid="input-verifier-name"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Position / Rank</Label>
                <div className="text-sm font-medium mt-2" data-testid="text-verifier-rank">
                  {storedDesignation || 'Unknown Position'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderPartB = () => (
    <div className="space-y-6">
      {checklistSections.length === 0 ? (
        <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
          <p className="text-sm font-medium">No checklist sections configured</p>
          <p className="text-xs mt-1">Please configure Part B in Admin &gt; Forms Configuration &gt; Promotion Review Form</p>
        </div>
      ) : null}
      {checklistSections.map((section) => (
        <div key={section.id} className="border border-[#EAEBEF] rounded-lg p-4">
          <h3 className="text-base font-medium text-[#16569e] mb-4" data-testid={`section-title-${section.id}`}>
            {section.number}. {section.title}
          </h3>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">S.No</TableHead>
                <TableHead>Assessment Point</TableHead>
                <TableHead className="w-24 text-center">Completed</TableHead>
                <TableHead className="w-32 text-center">Verified<br/>(No of times)</TableHead>
                <TableHead className="w-24 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {section.assessmentPoints.map((point) => (
                <React.Fragment key={point.id}>
                  <TableRow>
                    <TableCell className="font-medium">{point.number}</TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div>{point.text}</div>
                        
                        {point.comments.map((comment) => {
                          const isVerificationComment = comment.text === '';
                          const associatedVerification = isVerificationComment && comment.verificationId
                            ? point.verifications.find(v => v.id === comment.verificationId)
                            : null;
                          const isAuthor =
                            currentUser.name.trim().toLowerCase() === comment.userName.trim().toLowerCase();
                          const canCancel = isVerificationComment && associatedVerification && isAuthor;
                          const canEditComment = !isVerificationComment && isAuthor;
                          const isEditing = editingCommentId === comment.id;

                          return (
                            <div key={comment.id} className="text-sm text-blue-600 italic flex items-start gap-2">
                              <div className="flex-1">
                                {comment.text ? (
                                  isEditing ? (
                                    <div className="space-y-2">
                                      <div>
                                        <span className="font-medium">Comment by:</span> {comment.userName}, {comment.rank}, {comment.date}
                                      </div>
                                      <Textarea
                                        value={editCommentText}
                                        onChange={(e) => setEditCommentText(e.target.value)}
                                        className="w-full not-italic text-gray-900"
                                        rows={2}
                                        autoFocus
                                        data-testid={`textarea-edit-comment-${comment.id}`}
                                      />
                                      <div className="flex gap-2 justify-end">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setEditingCommentId(null);
                                            setEditCommentText('');
                                          }}
                                          data-testid={`button-cancel-edit-comment-${comment.id}`}
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() => handleSaveEditedComment(section.id, point.id, comment.id)}
                                          data-testid={`button-save-edit-comment-${comment.id}`}
                                        >
                                          Save
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="font-medium">Comment by:</span> {comment.userName}, {comment.rank}, {comment.date}
                                      <br />
                                      <span className="font-medium">Comment:</span> {comment.text}
                                    </>
                                  )
                                ) : (
                                  <>
                                    <span className="font-medium">Verified by:</span> {comment.userName}, {comment.rank}, {comment.date}
                                  </>
                                )}
                              </div>
                              {isVerificationComment && associatedVerification ? (
                                canCancel ? (
                                  <button
                                    onClick={() => handleCancelVerification(section.id, point.id, associatedVerification.id)}
                                    className="text-gray-400 hover:text-red-600"
                                    title="Cancel your verification"
                                    data-testid={`button-cancel-verification-${associatedVerification.id}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                ) : (
                                  <span className="text-gray-300 cursor-not-allowed" title="Only the verifier can cancel">
                                    <X className="h-3 w-3" />
                                  </span>
                                )
                              ) : !isEditing && (
                                <div className="flex items-start gap-1">
                                  {canEditComment && (
                                    <button
                                      onClick={() => {
                                        setEditingCommentId(comment.id);
                                        setEditCommentText(comment.text);
                                      }}
                                      className="text-gray-400 hover:text-blue-600"
                                      title="Edit comment"
                                      data-testid={`button-edit-comment-${comment.id}`}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteComment(section.id, point.id, comment.id)}
                                    className="text-gray-400 hover:text-red-600"
                                    title="Delete comment"
                                    data-testid={`button-delete-comment-${comment.id}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div 
                        className="flex items-center justify-center cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleToggleComplete(section.id, point.id);
                        }}
                      >
                        <Checkbox
                          checked={point.completed}
                          className="pointer-events-none"
                          data-testid={`checkbox-completed-${point.id}`}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        // Fall back to 1 when the admin hasn't configured a
                        // minimum — keeps the historical "any verification
                        // turns it green" behavior for un-migrated configs.
                        const minRequired = Math.max(1, checklistConfig?.minChecklistVerifications ?? 1);
                        const count = point.verifications.length;
                        const badgeClass =
                          count === 0
                            ? 'bg-gray-200 text-gray-700'
                            : count >= minRequired
                            ? 'bg-green-200 text-green-800'
                            : 'bg-yellow-200 text-yellow-800';
                        return (
                          <Badge
                            className={badgeClass}
                            data-testid={`badge-verified-${point.id}`}
                          >
                            {count}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setAttachmentDialog({ sectionId: section.id, pointId: point.id })}
                          className="text-gray-500 hover:text-blue-600 relative flex items-center gap-1"
                          title="Manage Attachments"
                          data-testid={`button-attachment-${point.id}`}
                        >
                          <Paperclip className="h-4 w-4" />
                          {point.attachments.length > 0 && (
                            <span
                              className="text-xs text-gray-600"
                              data-testid={`text-attachment-count-${point.id}`}
                            >
                              {point.attachments.length}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => handleToggleCommentBox(point.id)}
                          className="text-gray-500 hover:text-blue-600"
                          title="Add Comment"
                          data-testid={`button-comment-${point.id}`}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleVerify(section.id, point.id)}
                              className={`${
                                point.completed && hasValidName
                                  ? 'text-gray-500 hover:text-green-600'
                                  : 'text-gray-300 cursor-not-allowed'
                              }`}
                              disabled={!point.completed || !hasValidName}
                              data-testid={`button-verify-${point.id}`}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {!hasValidName 
                              ? 'Enter your name first'
                              : !point.completed 
                              ? 'Mark as completed first'
                              : 'Verify this point'}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                  
                  {activeCommentBox === point.id && (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-gray-50">
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-gray-700">{currentUser.name}</div>
                          <Textarea
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Add your comment..."
                            className="w-full"
                            rows={3}
                            data-testid={`textarea-comment-${point.id}`}
                          />
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setActiveCommentBox(null);
                                setCommentText('');
                              }}
                              data-testid={`button-cancel-comment-${point.id}`}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleAddComment(section.id, point.id)}
                              data-testid={`button-submit-comment-${point.id}`}
                            >
                              Add Comment
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[210] p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900">Promotion Checklist</h2>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              className="bg-[#60a5fa] hover:bg-[#3b82f6] text-white"
              data-testid="button-save-checklist"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              data-testid="button-close-checklist"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-[#f9fafb] space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="border-b pb-4 mb-6">
              <h3 className="text-lg font-semibold text-[#16569e]">Part A: General</h3>
              <p className="text-sm text-[#60a5fa] mt-1">This section is read only & provides information on the seafarer and summary of progress</p>
            </div>
            {renderPartA()}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="border-b pb-4 mb-6">
              <h3 className="text-lg font-semibold text-[#16569e]">Part B: Promotion Checklist</h3>
              <p className="text-sm text-[#60a5fa] mt-1">
                {checklistConfig?.minChecklistVerifications 
                  ? `At least ${checklistConfig.minChecklistVerifications} verification${checklistConfig.minChecklistVerifications !== 1 ? 's' : ''} required for each question`
                  : 'Verifications required as per configuration'
                }
              </p>
            </div>
            {renderPartB()}
          </div>
        </div>
      </div>

      {attachmentDialog && (() => {
        const section = checklistSections.find(s => s.id === attachmentDialog.sectionId);
        const point = section?.assessmentPoints.find(p => p.id === attachmentDialog.pointId);
        const fileAttachments = (point?.attachments ?? []).map(toFileAttachment);
        const truncatedName = point?.text && point.text.length > 80
          ? `${point.text.slice(0, 80)}…`
          : point?.text;
        return (
          <FileAttachmentDialog
            open={true}
            onOpenChange={(open) => {
              if (!open) setAttachmentDialog(null);
            }}
            attachments={fileAttachments}
            onAttachmentsChange={(next) =>
              handleAttachmentsChange(attachmentDialog.sectionId, attachmentDialog.pointId, next)
            }
            title="Manage Attachments"
            itemName={truncatedName}
            contentClassName="z-[220]"
          />
        );
      })()}
    </div>
  );
};
