import { useRef, useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, Trash2, FileText, Image as ImageIcon, ExternalLink, Download, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface FileAttachment {
  id: string;
  numericId?: number;
  name: string;
  type: string;
  size: number;
  data: string;
  uploadedAt: string;
  attUuid?: string;
  isDeleted?: boolean;
  isNew?: boolean;
}

interface FileAttachmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachments: FileAttachment[];
  onAttachmentsChange: (attachments: FileAttachment[]) => void;
  onDeleteAttachment?: (id: number, attUuid: string) => Promise<void>;
  title?: string;
  itemName?: string;
  contentClassName?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

export function FileAttachmentDialog({
  open,
  onOpenChange,
  attachments,
  onAttachmentsChange,
  onDeleteAttachment,
  title = 'Manage Attachments',
  itemName,
  contentClassName,
}: FileAttachmentDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ url: string; type: string; name: string } | null>(null);

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const errors: string[] = [];
    const validFiles: File[] = [];

    Array.from(files).forEach((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type. Only PDF, JPG, and PNG are allowed.`);
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large. Maximum size is 5MB.`);
        return;
      }

      validFiles.push(file);
    });

    const readFile = (file: File) =>
      new Promise<FileAttachment | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            type: file.type,
            size: file.size,
            data: e.target?.result as string,
            uploadedAt: new Date().toISOString(),
            isNew: true,
          });
        };
        reader.onerror = () => {
          errors.push(`${file.name}: Failed to read file.`);
          resolve(null);
        };
        reader.readAsDataURL(file);
      });

    const results = await Promise.all(validFiles.map(readFile));
    const newAttachments = results.filter((a): a is FileAttachment => a !== null);

    if (newAttachments.length > 0) {
      onAttachmentsChange([...attachments, ...newAttachments]);
      toast({
        title: newAttachments.length === 1 ? 'File Uploaded' : 'Files Uploaded',
        description:
          newAttachments.length === 1
            ? `${newAttachments[0].name} has been attached successfully.`
            : `${newAttachments.length} files have been attached successfully.`,
      });
    }

    if (errors.length > 0) {
      toast({
        title: 'Upload Error',
        description: errors.join('\n'),
        variant: 'destructive',
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = async (id: string) => {
    const attachment = attachments.find((a) => a.id === id);
    
    if (attachment) {
      const fileName = attachment.name || (attachment as any).fileName || 'file';
      const numericId = (attachment as any).numericId || parseInt(id, 10);
      
      if (attachment.attUuid && onDeleteAttachment && !isNaN(numericId)) {
        try {
          await onDeleteAttachment(numericId, attachment.attUuid);
          onAttachmentsChange(attachments.filter((a) => a.id !== id));
          toast({
            title: 'File Deleted',
            description: `${fileName} has been deleted.`,
          });
        } catch (error) {
          toast({
            title: 'Delete Failed',
            description: `Failed to delete ${fileName}. Please try again.`,
            variant: 'destructive',
          });
        }
      } else if (attachment.attUuid) {
        onAttachmentsChange(
          attachments.map((a) => 
            a.id === id ? { ...a, isDeleted: true } : a
          )
        );
        toast({
          title: 'File Marked for Deletion',
          description: `${fileName} will be removed when you save.`,
        });
      } else {
        onAttachmentsChange(attachments.filter((a) => a.id !== id));
        toast({
          title: 'File Removed',
          description: `${fileName} has been removed.`,
        });
      }
    }
  };

  const dataUrlToBlob = (dataUrl: string): Blob => {
    const [header, base64Data] = dataUrl.split(',');
    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  };

  const getFileContent = (attachment: FileAttachment): string => {
    const att = attachment as any;
    return attachment.data || att.fileData || att.filePath || att.fileUrl || '';
  };

  const handlePreview = (attachment: FileAttachment) => {
    const att = attachment as any;
    const fileName = attachment.name || att.fileName || 'file';
    const fileType = attachment.type || att.fileType || att.mimeType || '';
    const fileData = getFileContent(attachment);

    if (!fileData) {
      toast({
        title: 'Unable to open file',
        description: 'No file data available for preview.',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (fileData.startsWith('data:')) {
        const blob = dataUrlToBlob(fileData);
        const blobUrl = URL.createObjectURL(blob);
        setPreview({ url: blobUrl, type: fileType, name: fileName });
      } else {
        setPreview({ url: fileData, type: fileType, name: fileName });
      }
    } catch {
      toast({
        title: 'Unable to open file',
        description: 'The file data appears to be corrupted.',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = () => {
    if (!preview) return;
    const link = document.createElement('a');
    link.href = preview.url;
    link.download = preview.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const closePreview = () => setPreview(null);

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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={`sm:max-w-[500px] ${contentClassName ?? ''}`}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {itemName ? `Attachments for: ${itemName}` : 'Upload PDF or image files (JPG, PNG). Max 5MB per file.'}
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
              data-testid="input-file-attachment"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-dashed border-2 h-20 hover:bg-gray-50"
              data-testid="button-upload-file"
            >
              <div className="flex flex-col items-center gap-1">
                <Upload className="h-6 w-6 text-gray-400" />
                <span className="text-sm text-gray-600">Click to upload files</span>
                <span className="text-xs text-gray-400">PDF, JPG, PNG (max 5MB)</span>
              </div>
            </Button>

            {attachments.filter(a => !a.isDeleted).length > 0 && (
              <ScrollArea className="h-[200px] border rounded-md p-2">
                <div className="space-y-2">
                  {attachments.filter(a => !a.isDeleted).map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center gap-3 p-2 border rounded-md bg-gray-50 hover:bg-gray-100"
                      data-testid={`attachment-item-${attachment.id}`}
                    >
                      <div className="flex-shrink-0">
                        {(attachment.type || (attachment as any).fileType || (attachment as any).mimeType || '')?.startsWith('image/') ? (
                          <img
                            src={getFileContent(attachment)}
                            alt={attachment.name || (attachment as any).fileName}
                            className="h-10 w-10 object-cover rounded"
                          />
                        ) : (
                          getFileIcon(attachment.type || (attachment as any).fileType || (attachment as any).mimeType || '')
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {attachment.name || (attachment as any).fileName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(attachment.size || parseInt((attachment as any).fileSize || '0'))}
                        </p>
                      </div>

                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-blue-600"
                          onClick={() => handlePreview(attachment)}
                          data-testid={`button-preview-${attachment.id}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-red-600"
                          onClick={() => handleRemoveAttachment(attachment.id)}
                          data-testid={`button-remove-${attachment.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {attachments.filter(a => !a.isDeleted).length === 0 && (
              <div className="text-center py-6 text-gray-500">
                <FileText className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No attachments yet</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <div className="flex justify-between w-full items-center">
              <span className="text-sm text-gray-500">
                {attachments.filter(a => !a.isDeleted).length} file{attachments.filter(a => !a.isDeleted).length !== 1 ? 's' : ''} attached
              </span>
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                data-testid="button-close-attachment-dialog"
              >
                Done
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => { if (!o) closePreview(); }}>
        <DialogContent className="max-w-4xl w-[90vw] h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-base truncate pr-4">{preview?.name}</DialogTitle>
            <DialogDescription className="sr-only">File preview</DialogDescription>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleDownload}
                title="Download"
                data-testid="button-download-preview"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={closePreview}
                title="Close"
                data-testid="button-close-preview"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-gray-100 overflow-auto">
            {preview && (
              preview.type.startsWith('image/') ? (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <img
                    src={preview.url}
                    alt={preview.name}
                    className="max-w-full max-h-full object-contain"
                    data-testid="img-preview"
                  />
                </div>
              ) : (
                <iframe
                  src={preview.url}
                  title={preview.name}
                  className="w-full h-full border-0"
                  data-testid="iframe-preview"
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
