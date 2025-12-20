import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface AccessDeniedProps {
  message?: string;
}

export function AccessDenied({ message }: AccessDeniedProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <ShieldX className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="font-serif text-lg font-bold text-foreground">
        Action non autorisée
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {message || 'Vous n\'avez pas les permissions nécessaires pour accéder à cette ressource.'}
      </p>
      <Button variant="outline" onClick={() => navigate('/dashboard')}>
        Retour au tableau de bord
      </Button>
    </div>
  );
}
