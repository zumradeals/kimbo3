import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, Paperclip, X, FileImage, FileText, File } from 'lucide-react';
import { BesoinAttachment } from '@/types/kpm';

interface AttachmentInput {
  id: string;
  file?: File;
  file_url: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  isUploading?: boolean;
}

interface BesoinAttachmentsUploadProps {
  attachments: AttachmentInput[];
  onChange: (attachments: AttachmentInput[]) => void;
  besoinId?: string;
  readOnly?: boolean;
}

const ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo

export function BesoinAttachmentsUpload({ attachments, onChange, besoinId, readOnly = false }: BesoinAttachmentsUploadProps) {
  const { toast } = useToast();
  const [isDragOver, setIsDragOver] = useState(false);

  const getFileIcon = (type: string | null) => {
    if (!type) return File;
    if (type.startsWith('image/')) return FileImage;
    if (type === 'application/pdf') return FileText;
    return File;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const newAttachments: AttachmentInput[] = [];

    Array.from(files).forEach((file) => {
      // Validate type
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast({
          title: 'Type de fichier non autorisé',
          description: `"${file.name}" n'est pas un format accepté.`,
          variant: 'destructive',
        });
        return;
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: 'Fichier trop volumineux',
          description: `"${file.name}" dépasse la limite de 10 Mo.`,
          variant: 'destructive',
        });
        return;
      }

      newAttachments.push({
        id: crypto.randomUUID(),
        file,
        file_url: URL.createObjectURL(file),
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
      });
    });

    if (newAttachments.length > 0) {
      onChange([...attachments, ...newAttachments]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeAttachment = (id: string) => {
    onChange(attachments.filter((a) => a.id !== id));
  };

  if (readOnly) {
    if (attachments.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">Aucune pièce jointe</p>
      );
    }

    return (
      <div className="space-y-2">
        {attachments.map((attachment) => {
          const FileIcon = getFileIcon(attachment.file_type);
          return (
            <a
              key={attachment.id}
              href={attachment.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-md border bg-muted/30 p-3 hover:bg-muted/50 transition-colors"
            >
              <FileIcon className="h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.file_size)}
                </p>
              </div>
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-md border-2 border-dashed p-6 transition-colors cursor-pointer ${
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
      >
        <input
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(',')}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center gap-2 text-center">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Glissez vos fichiers ou cliquez pour sélectionner
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Images, PDF, Word, Excel (max 10 Mo par fichier)
            </p>
          </div>
        </div>
      </div>

      {/* Attachments list */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const FileIcon = getFileIcon(attachment.file_type);
            return (
              <div
                key={attachment.id}
                className="flex items-center gap-3 rounded-md border bg-muted/30 p-3"
              >
                <FileIcon className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.file_size)}
                    {attachment.isUploading && ' • Upload en cours...'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeAttachment(attachment.id)}
                  className="h-8 w-8 shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Formats acceptés : PNG, JPG, PDF, Word, Excel. Ces pièces sont liées au besoin et transmises à la logistique.
      </p>
    </div>
  );
}
