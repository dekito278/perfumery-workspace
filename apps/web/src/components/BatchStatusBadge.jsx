
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, CheckCircle2 } from 'lucide-react';

const BatchStatusBadge = ({ status, showIcon = false }) => {
  const statusConfig = {
    draft: {
      variant: 'secondary',
      label: 'Draft',
      icon: FileText,
      className: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    },
    in_progress: {
      variant: 'default',
      label: 'In progress',
      icon: Loader2,
      className: 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200'
    },
    completed: {
      variant: 'default',
      label: 'Completed',
      icon: CheckCircle2,
      className: 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200'
    }
  };

  const config = statusConfig[status] || statusConfig.draft;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={config.className}>
      {showIcon && <Icon className="w-3 h-3 mr-1" />}
      {config.label}
    </Badge>
  );
};

export default BatchStatusBadge;
