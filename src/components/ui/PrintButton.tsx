import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface PrintButtonProps {
  onClick?: () => void;
  label?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function PrintButton({ onClick, label = 'Imprimer', size = 'sm' }: PrintButtonProps) {
  const handlePrint = () => {
    if (onClick) {
      onClick();
    } else {
      window.print();
    }
  };

  return (
    <Button variant="outline" size={size} onClick={handlePrint}>
      <Printer className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
