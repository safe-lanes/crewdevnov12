import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Paperclip, MessageSquare, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { z } from 'zod';
import type { CrewMember, PromotionA2Config } from '@shared/schema';

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
}

export const PromotionChecklistForm: React.FC<PromotionChecklistFormProps> = ({
  promotionData,
  onClose,
  checklistConfig,
}) => {

  // Fetch crew member data including sea service
  const { data: crewMember, isLoading: isLoadingCrew, error: crewError } = useQuery<CrewMember>({
    queryKey: [`/api/crew-members/${promotionData.crewMemberId}`],
    enabled: !!promotionData.crewMemberId,
  });

  // Use promotion data passed from parent
  const seafarerData = {
    name: promotionData?.name || 'N/A',
    rank: promotionData?.currentRank || 'N/A',
    promotionRank: promotionData?.promotionToRank || 'N/A',
    vessel: promotionData?.vesselLeave || 'N/A',
    dateOfBirth: promotionData?.dob || 'N/A',
    age: promotionData?.age || 'N/A',
    nationality: promotionData?.nationality || 'N/A',
  };

  // Parse sea service data from crew member
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

  // Mock current user (for testing)
  const currentUser = {
    name: 'Current User',
    rank: 'Chief Officer',
    role: 'Department Head' // or 'Crewmember'
  };

  // Initialize checklist sections from configuration or use empty array
  const initializeSectionsFromConfig = React.useCallback((): ChecklistSection[] => {
    if (checklistConfig?.checklistSections?.length) {
      // Transform configuration sections into runtime format with completed/verifications/comments/attachments
      return checklistConfig.checklistSections.map((configSection) => ({
        id: configSection.id,
        number: configSection.id,
        title: configSection.title,
        assessmentPoints: configSection.assessmentPoints.map((configPoint) => ({
          id: configPoint.id,
          number: configPoint.id,
          text: configPoint.text,
          completed: false,
          verifications: [],
          comments: [],
          attachments: [],
        })),
      }));
    }
    // Return empty array if no configuration - admin needs to configure Part B
    return [];
  }, [checklistConfig]);

  const [checklistSections, setChecklistSections] = React.useState<ChecklistSection[]>(initializeSectionsFromConfig);

  // Update sections when checklistConfig changes (always sync, even if empty)
  React.useEffect(() => {
    const newSections = initializeSectionsFromConfig();
    setChecklistSections(newSections);
  }, [initializeSectionsFromConfig]);

  // State for managing UI interactions
  const [activeCommentBox, setActiveCommentBox] = React.useState<string | null>(null);
  const [commentText, setCommentText] = React.useState<string>('');

  const handleSave = () => {
    console.log('Saving Promotion Checklist...');
    console.log('Checklist Data:', checklistSections);
    // Add save logic here
    onClose();
  };

  // Handler for toggling completion checkbox
  const handleToggleComplete = (sectionId: string, pointId: string) => {
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

  // Handler for adding attachment
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

  // Handler for toggling comment box
  const handleToggleCommentBox = (pointId: string) => {
    if (activeCommentBox === pointId) {
      setActiveCommentBox(null);
      setCommentText('');
    } else {
      setActiveCommentBox(pointId);
      setCommentText('');
    }
  };

  // Handler for adding comment
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

  // Handler for verification badge click
  const handleVerify = (sectionId: string, pointId: string) => {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }).replace(/ /g, ' ');

    const newVerification: ChecklistVerification = {
      id: `verify-${Date.now()}`,
      verifierName: currentUser.name,
      rank: currentUser.rank,
      date: formattedDate
    };

    // Create verification comment with the verification text
    const verificationComment: ChecklistComment = {
      id: `vcomment-${Date.now()}`,
      userName: currentUser.name,
      rank: currentUser.rank,
      text: '', // Empty text, will display as "Verified by: [name], [rank], [date]"
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

  // Handler for deleting comment
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
      {/* A1: Seafarer's Information */}
      <div className="border border-[#EAEBEF] rounded-lg p-4">
        <h3 className="text-base font-medium text-[#16569e] mb-4">A1. Seafarer's Information</h3>
        
        <div className="space-y-4">
          {/* Row 1: Name, DOB/Age, Nationality */}
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
          
          {/* Row 2: Present Rank, Promotion to Rank */}
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

      {/* A2: Details of Sea Service */}
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
                      <TableCell className="text-sm" data-testid={`cell-engine-power-${service.id || index}`}>{service.engineType || service.enginePower || 'N/A'}</TableCell>
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

      {/* A3: Checklist Progress */}
      <div className="border border-[#EAEBEF] rounded-lg p-4">
        <h3 className="text-base font-medium text-[#16569e] mb-4">A3. Checklist Progress</h3>
        
        <div className="space-y-3">
          <div className="text-sm text-gray-600 mb-3">
            Note: No of verifications required for each question: <span className="text-green-600 font-medium">{checklistConfig?.minChecklistVerifications ?? 'N/A'}</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-[#EAB308] h-3 rounded-full" style={{ width: '60%' }}></div>
              </div>
            </div>
            <div className="text-sm font-medium text-gray-700 whitespace-nowrap">
              60% (44/110 Verifications)
            </div>
          </div>
        </div>
      </div>
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
                        
                        {/* Display existing comments */}
                        {point.comments.map((comment) => (
                          <div key={comment.id} className="text-sm text-blue-600 italic flex items-start gap-2">
                            <div className="flex-1">
                              {comment.text ? (
                                <>
                                  <span className="font-medium">Verified by:</span> {comment.userName}, {comment.rank}, {comment.date}
                                  {comment.text && (
                                    <>
                                      <br />
                                      <span className="font-medium">Comment:</span> {comment.text}
                                    </>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span className="font-medium">Verified by:</span> {comment.userName}, {comment.rank}, {comment.date}
                                </>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteComment(section.id, point.id, comment.id)}
                              className="text-gray-400 hover:text-red-600"
                              data-testid={`button-delete-comment-${comment.id}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div 
                        className="flex items-center justify-center cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleComplete(section.id, point.id);
                        }}
                      >
                        <Checkbox
                          checked={point.completed}
                          onCheckedChange={() => handleToggleComplete(section.id, point.id)}
                          data-testid={`checkbox-completed-${point.id}`}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={`${
                          point.verifications.length === 0
                            ? 'bg-gray-200 text-gray-700'
                            : point.verifications.length === 1
                            ? 'bg-yellow-200 text-yellow-800'
                            : 'bg-green-200 text-green-800'
                        }`}
                        data-testid={`badge-verified-${point.id}`}
                      >
                        {point.verifications.length}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleAddAttachment(section.id, point.id)}
                          className="text-gray-500 hover:text-blue-600"
                          title="Add Attachment"
                          data-testid={`button-attachment-${point.id}`}
                        >
                          <Paperclip className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleCommentBox(point.id)}
                          className="text-gray-500 hover:text-blue-600"
                          title="Add Comment"
                          data-testid={`button-comment-${point.id}`}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleVerify(section.id, point.id)}
                          className="text-gray-500 hover:text-green-600"
                          title="Verify"
                          data-testid={`button-verify-${point.id}`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                  
                  {/* Comment box row */}
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

                  {/* Attachments display */}
                  {point.attachments.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-blue-50">
                        <div className="text-sm">
                          <span className="font-medium">Attachments: </span>
                          {point.attachments.map((att, idx) => (
                            <span key={att.id}>
                              {att.fileName}
                              {idx < point.attachments.length - 1 && ', '}
                            </span>
                          ))}
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900">Promotion Checklist</h2>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              className="bg-[#60a5fa] hover:bg-[#3b82f6] text-white"
              data-testid="button-save-checklist"
            >
              Save
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

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#f9fafb] space-y-6">
          {/* Part A: General */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="border-b pb-4 mb-6">
              <h3 className="text-lg font-semibold text-[#16569e]">Part A: General</h3>
              <p className="text-sm text-[#60a5fa] mt-1">This section is read only & provides information on the seafarer and summary of progress</p>
            </div>
            {renderPartA()}
          </div>

          {/* Part B: Promotion Checklist */}
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
    </div>
  );
};
