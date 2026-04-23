import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Paperclip, X, FileText, Upload } from 'lucide-react';

export interface PendingAttachment {
  id: string;
  file: File;
}

interface MultiAttachmentsInputProps {
  pending: PendingAttachment[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  maxSizeMB?: number;
  label?: string;
}

export function MultiAttachmentsInput({
  pending,
  onAdd,
  onRemove,
  maxSizeMB = 10,
  label = 'Pièces jointes',
}: MultiAttachmentsInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const oversize = files.find((f) => f.size > maxSizeMB * 1024 * 1024);
    if (oversize) {
      setError(`Fichier "${oversize.name}" trop volumineux (max ${maxSizeMB} Mo).`);
      return;
    }
    setError(null);
    onAdd(files);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Paperclip className="h-3.5 w-3.5" />
        {label}
      </Label>
      <div className="rounded-md border-2 border-dashed border-muted-foreground/25 p-3 hover:border-primary/50 transition-colors">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
          onChange={handleSelect}
          className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
        />
        <p className="text-xs text-muted-foreground mt-2">
          PDF, image, Word ou Excel — plusieurs fichiers possibles (max {maxSizeMB} Mo chacun)
        </p>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {pending.length > 0 && (
        <ul className="space-y-2 mt-2">
          {pending.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-md border bg-muted/30 p-2"
            >
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(p.file.size / 1024).toFixed(0)} Ko
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemove(p.id)}
                className="h-7 w-7 shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
