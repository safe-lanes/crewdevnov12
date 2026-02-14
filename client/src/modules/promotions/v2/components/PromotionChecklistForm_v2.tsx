import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Paperclip, MessageSquare, CheckCircle2, Loader2 } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
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
import type { CrewMember, PromotionA2Config } from '@shared/schema';
import { calculateChecklistProgress } from '../../checklistProgressUtils';

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
}

interface ChecklistVerification {
  id: string;
  verifierName: string;
  rank: string;
  date: string;
}

interface ChecklistAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  uploadDate: string;
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
  existingChecklistData?: string | null;
}

export const PromotionChecklistForm_v2: React.FC<PromotionChecklistFormProps> = ({
  promotionData,
  onClose,
  checklistConfig,
  promotionReviewId,
  existingChecklistData,
}) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);

  const { data: crewMember, isLoading: isLoadingCrew, error: crewError } = useQuery<CrewMember>({
    queryKey: [`/api/crew-members/${promotionData.crewMemberId}`],
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
    if (!crewMember?.currentCompanySeaService) return [];
    try {
      const parsed = typeof crewMember.currentCompanySeaService === 'string'
        ? JSON.parse(crewMember.currentCompanySeaService)
        : crewMember.currentCompanySeaService;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [crewMember]);

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
            
            return {
              id: configPoint.id,
              number: configPoint.id,
              text: configPoint.text,
              completed: savedPoint?.completed ?? false,
              verifications: savedPoint?.verifications ?? [],
              comments: savedPoint?.comments ?? [],
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

  const handleSave = async () => {
    if (!promotionReviewId) {
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
      
      await apiRequest('PATCH', `/api/v2/promotions/reviews/${promotionReviewId}`, { checklistProgressData });
      
      queryClient.invalidateQueries({ queryKey: ['/api/v2/promotions/reviews'] });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/v2/promotions/reviews/crew/${promotionData.crewMemberId}/rank/${promotionData.promotionToRank}`] 
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

  const handleAddAttachment = (sectionId: string, pointId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const newAttachment: ChecklistAttachment = {
          id: `att-${Date.now()}`,
          fileName: file.name,
          fileSize: file.size,
          uploadDate: new Date().toLocaleDateString()
        };
        setChecklistSections(prev => prev.map(section =>
          section.id === sectionId
            ? {
                ...section,
                assessmentPoints: section.assessmentPoints.map(point =>
                  point.id === pointId
                    ? { ...point, attachments: [...point.attachments, newAttachment] }
                    : point
                )
              }
            : section
        ));
      }
    };
    input.click();
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

    const newVerification: ChecklistVerification = {
      id: `verify-${Date.now()}`,
      verifierName: currentUser.name,
      rank: currentUser.rank,
      date: formattedDate
    };

    const verificationComment: ChecklistComment = {
      id: `vcomment-${Date.now()}`,
      userName: currentUser.name,
      rank: currentUser.rank,
      text: '',
      date: formattedDate
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
                    comments: p.comments.filter(c => 
                      !(c.userName === verification.verifierName && 
                        c.date === verification.date && 
                        c.text === '')
                    )
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
                {seaServiceData.length > 0 ? seaServiceData.map((entry, idx) => (
                  <TableRow key={entry.id || idx}>
                    <TableCell className="text-xs">{entry.vesselName || entry.vessel || '-'}</TableCell>
                    <TableCell className="text-xs">{entry.vesselType || '-'}</TableCell>
                    <TableCell className="text-xs">{entry.deadweight || '-'}</TableCell>
                    <TableCell className="text-xs">{entry.engineType ? `${entry.engineType}${entry.enginePower ? ` / ${entry.enginePower}` : ''}` : '-'}</TableCell>
                    <TableCell className="text-xs">{entry.fromDate || entry.from || '-'}</TableCell>
                    <TableCell className="text-xs">{entry.toDate || entry.to || '-'}</TableCell>
                    <TableCell className="text-xs">{entry.period || entry.duration || '-'}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-xs text-gray-400 py-4">No sea service records found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );

  const renderPartB = () => (
    <div className="space-y-4">
      <div className="border border-[#EAEBEF] rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-medium text-[#16569e]">A3. Promotion Checklist</h3>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              Progress: <span className={checklistProgress.meetsThreshold ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>
                {checklistProgress.percentage}%
              </span>
              <span className="text-gray-400 ml-1">
                ({checklistProgress.completedVerifications}/{checklistProgress.totalRequired} verifications, threshold: {checklistProgress.thresholdPercent}%)
              </span>
            </div>
          </div>
        </div>

        {showNameInput && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <Label className="text-xs text-blue-700 font-medium">Verifier Information</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                className="h-8 text-sm max-w-xs"
                placeholder="Enter your name"
                value={userName}
                onChange={(e) => handleNameChange(e.target.value)}
                data-testid="input-verifier-name"
              />
              {storedDesignation && (
                <span className="text-xs text-gray-500">{storedDesignation}</span>
              )}
            </div>
          </div>
        )}

        {checklistSections.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No checklist sections configured.</p>
            <p className="text-xs mt-1">Please configure promotion checklist sections in Admin Module.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {checklistSections.map((section) => (
              <div key={section.id} className="border border-gray-200 rounded-lg">
                <div className="bg-gray-50 px-4 py-2 rounded-t-lg">
                  <h4 className="text-sm font-medium text-gray-700">{section.number}. {section.title}</h4>
                </div>
                <div className="p-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 text-xs">Done</TableHead>
                        <TableHead className="text-xs">Assessment Point</TableHead>
                        <TableHead className="w-24 text-xs text-center">Verify</TableHead>
                        <TableHead className="w-20 text-xs text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {section.assessmentPoints.map((point) => (
                        <React.Fragment key={point.id}>
                          <TableRow>
                            <TableCell>
                              <Checkbox
                                checked={point.completed}
                                onCheckedChange={() => handleToggleComplete(section.id, point.id)}
                                data-testid={`checkbox-point-${point.id}`}
                              />
                            </TableCell>
                            <TableCell className="text-xs">
                              <span className="font-medium">{point.number}</span> {point.text}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => handleVerify(section.id, point.id)}
                                disabled={!point.completed || !hasValidName}
                                data-testid={`button-verify-${point.id}`}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Verify ({point.verifications.length})
                              </Button>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => handleAddAttachment(section.id, point.id)}
                                  data-testid={`button-attach-${point.id}`}
                                >
                                  <Paperclip className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => handleToggleCommentBox(point.id)}
                                  data-testid={`button-comment-${point.id}`}
                                >
                                  <MessageSquare className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {point.verifications.length > 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="py-1 px-8">
                                <div className="flex flex-wrap gap-1">
                                  {point.verifications.map((v) => (
                                    <Badge 
                                      key={v.id} 
                                      variant="secondary" 
                                      className="text-xs cursor-pointer"
                                      onClick={() => handleCancelVerification(section.id, point.id, v.id)}
                                      data-testid={`badge-verification-${v.id}`}
                                    >
                                      {v.verifierName} ({v.date})
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                          {point.comments.length > 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="py-1 px-8">
                                <div className="space-y-1">
                                  {point.comments.map((c) => (
                                    <div key={c.id} className="flex items-start gap-2 text-xs">
                                      <span className="font-medium text-gray-600">{c.userName}:</span>
                                      {c.text ? (
                                        <span className="text-gray-500">{c.text}</span>
                                      ) : (
                                        <span className="text-green-600 italic">Verified by: {c.userName}, {c.rank}, {c.date}</span>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-4 w-4 p-0 ml-auto"
                                        onClick={() => handleDeleteComment(section.id, point.id, c.id)}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                          {point.attachments.length > 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="py-1 px-8">
                                <div className="flex flex-wrap gap-1">
                                  {point.attachments.map((a) => (
                                    <Badge key={a.id} variant="outline" className="text-xs">
                                      <Paperclip className="h-3 w-3 mr-1" />
                                      {a.fileName}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                          {activeCommentBox === point.id && (
                            <TableRow>
                              <TableCell colSpan={4} className="py-2 px-8">
                                <div className="flex items-start gap-2">
                                  <Textarea
                                    className="text-xs min-h-[60px]"
                                    placeholder="Add a comment..."
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    data-testid={`textarea-comment-${point.id}`}
                                  />
                                  <Button
                                    size="sm"
                                    className="h-8"
                                    onClick={() => handleAddComment(section.id, point.id)}
                                    data-testid={`button-submit-comment-${point.id}`}
                                  >
                                    Add
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-[90vw] max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-[#16569e]">Promotion Checklist</h2>
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-checklist">
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {renderPartA()}
          {renderPartB()}
        </div>
        
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-checklist">
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            data-testid="button-save-checklist"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Checklist'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
