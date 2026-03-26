import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Eraser } from 'lucide-react';

interface SignaturePadProps {
  onSignatureChange: (dataUrl: string | null) => void;
  width?: number;
  height?: number;
}

export function SignaturePad({ onSignatureChange, width = 400, height = 150 }: SignaturePadProps) {
  const sigRef = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const handleEnd = () => {
    if (sigRef.current && !sigRef.current.isEmpty()) {
      setIsEmpty(false);
      onSignatureChange(sigRef.current.getTrimmedCanvas().toDataURL('image/png'));
    }
  };

  const handleClear = () => {
    sigRef.current?.clear();
    setIsEmpty(true);
    onSignatureChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 bg-background overflow-hidden">
        <SignatureCanvas
          ref={sigRef}
          penColor="#1e1e1e"
          canvasProps={{
            width,
            height,
            className: 'w-full',
            style: { width: '100%', height: `${height}px` },
          }}
          onEnd={handleEnd}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {isEmpty ? 'Signez dans la zone ci-dessus' : '✓ Signature capturée'}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={isEmpty}>
          <Eraser className="mr-1 h-3 w-3" />Effacer
        </Button>
      </div>
    </div>
  );
}
