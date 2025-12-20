import { Clock } from 'lucide-react';

interface ModulePendingProps {
  title: string;
  description?: string;
}

export function ModulePending({ title, description }: ModulePendingProps) {
  return (
    <div className="module-pending">
      <Clock className="module-pending-icon" />
      <h2 className="module-pending-title">{title}</h2>
      <p className="module-pending-description">
        {description || 'Ce module sera disponible dans une prochaine version.'}
      </p>
    </div>
  );
}
