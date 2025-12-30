import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, Trash2, FileText, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface HandoverAttachment {
  id: string;
  filename: string;
  fileType: string;
  fileData: string;
  fileSize: number;
  uploadedBy: string;
  uploadDate: string;
}

interface HandoverAttachmentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planningId: number;
  vesselId: string;
  crewName: string;
  rank: string;
  onAttachmentsChanged?: (hasAttachments: boolean) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

export function HandoverAttachmentsDialog({
  open,
  onOpenChange,
  planningId,
  vesselId,
  crewName,
  rank,
  onAttachmentsChanged,
}: HandoverAttachmentsDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());

  const { data: attachments = [], isLoading, refetch } = useQuery<HandoverAttachment[]>({
    queryKey: ['/api/vessel-planning', planningId, 'handover-attachments'],
    queryFn: async () => {
      const response = await fetch(`/api/vessel-planning/${planningId}/handover-attachments`);
      if (!response.ok) throw new Error('Failed to fetch attachments');
      return response.json();
    },
    enabled: open && !!planningId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (attachment: { filename: string; fileType: string; fileData: string; fileSize: number }) => {
      return apiRequest('POST', `/api/vessel-planning/${planningId}/handover-attachments`, attachment);
    },
    onSuccess: (_, variables) => {
      refetch();
      onAttachmentsChanged?.(true);
      queryClient.invalidateQueries({ queryKey: ['/api/vessel-planning/vessel', vesselId] });
      setUploadingFiles(prev => {
        const next = new Set(prev);
        next.delete(variables.filename);
        return next;
      });
      toast({
        title: 'File Uploaded',
        description: `${variables.filename} has been attached successfully.`,
      });
    },
    onError: (error, variables) => {
      setUploadingFiles(prev => {
        const next = new Set(prev);
        next.delete(variables.filename);
        return next;
      });
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload file. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      return apiRequest('DELETE', `/api/vessel-planning/${planningId}/handover-attachments/${attachmentId}`);
    },
    onSuccess: (_, attachmentId) => {
      const deletedAttachment = attachments.find(a => a.id === attachmentId);
      refetch().then(() => {
        const remaining = attachments.filter(a => a.id !== attachmentId);
        onAttachmentsChanged?.(remaining.length > 0);
      });
      queryClient.invalidateQueries({ queryKey: ['/api/vessel-planning/vessel', vesselId] });
      toast({
        title: 'File Removed',
        description: deletedAttachment ? `${deletedAttachment.filename} has been removed.` : 'File has been removed.',
      });
    },
    onError: () => {
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete file. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast({
          title: 'Invalid File Type',
          description: `${file.name}: Only PDF, JPG, and PNG are allowed.`,
          variant: 'destructive',
        });
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: 'File Too Large',
          description: `${file.name}: Maximum size is 5MB.`,
          variant: 'destructive',
        });
        return;
      }

      setUploadingFiles(prev => new Set(prev).add(file.name));

      const reader = new FileReader();
      reader.onload = (e) => {
        uploadMutation.mutate({
          filename: file.name,
          fileType: file.type,
          fileData: e.target?.result as string,
          fileSize: file.size,
        });
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (attachment: HandoverAttachment) => {
    deleteMutation.mutate(attachment.id);
  };

  const handlePreview = (attachment: HandoverAttachment) => {
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      if (attachment.fileType === 'application/pdf') {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head><title>${attachment.filename}</title></head>
            <body style="margin:0;padding:0;height:100vh;">
              <embed src="${attachment.fileData}" type="application/pdf" width="100%" height="100%" />
            </body>
          </html>
        `);
      } else {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head><title>${attachment.filename}</title></head>
            <body style="margin:0;padding:20px;display:flex;justify-content:center;align-items:flex-start;background:#f5f5f5;">
              <img src="${attachment.fileData}" alt="${attachment.filename}" style="max-width:100%;height:auto;" />
            </body>
          </html>
        `);
      }
      newWindow.document.close();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type === 'application/pdf') {
      return <FileText className="h-8 w-8 text-red-500" />;
    }
    return <ImageIcon className="h-8 w-8 text-blue-500" />;
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const isUploading = uploadingFiles.size > 0 || uploadMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle style={{ color: '#16569e' }}>Handover Attachments</DialogTitle>
            <DialogDescription>
              {crewName} - {rank}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-handover-file"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-dashed border-2 h-20 hover:bg-gray-50"
              disabled={isUploading}
              data-testid="button-upload-handover-file"
            >
              <div className="flex flex-col items-center gap-1">
                <Upload className="h-6 w-6 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {isUploading ? 'Uploading...' : 'Click to upload files'}
                </span>
                <span className="text-xs text-gray-400">PDF, JPG, PNG (max 5MB)</span>
              </div>
            </Button>

            {isLoading ? (
              <div className="text-center text-sm text-gray-500 py-4">Loading attachments...</div>
            ) : attachments.length > 0 ? (
              <ScrollArea className="h-[200px] border rounded-md p-2">
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center gap-3 p-2 bg-gray-50 rounded-md"
                      data-testid={`handover-attachment-${attachment.id}`}
                    >
                      {getFileIcon(attachment.fileType)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{attachment.filename}</p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(attachment.fileSize)} - {formatDate(attachment.uploadDate)}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePreview(attachment)}
                          className="h-8 w-8"
                          data-testid={`button-preview-${attachment.id}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveAttachment(attachment)}
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${attachment.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center text-sm text-gray-500 py-4">
                No attachments yet
              </div>
            )}

            <div className="text-xs text-gray-500 text-center">
              {attachments.length} file{attachments.length !== 1 ? 's' : ''} attached
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function getHandoverAttachmentCount(handoverAttachments: string | null | undefined): number {
  if (!handoverAttachments) return 0;
  try {
    const attachments = typeof handoverAttachments === 'string' 
      ? JSON.parse(handoverAttachments)
      : handoverAttachments;
    return Array.isArray(attachments) ? attachments.length : 0;
  } catch {
    return 0;
  }
}
