import React from 'react';
import { cn } from '../../../lib/utils';
import { MessageSquareOff } from 'lucide-react';

export const EmptyState = ({ icon: Icon = MessageSquareOff, title, message, className }) => {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center p-8 h-full", className)}>
      <div className="w-16 h-16 rounded-full bg-surface-secondary flex items-center justify-center mb-6 text-text-muted">
        <Icon size={32} strokeWidth={1.5} />
      </div>
      {title && <h3 className="font-headline-md text-[24px] text-text-primary mb-2">{title}</h3>}
      {message && <p className="font-display-lg font-serif italic text-text-secondary max-w-md">{message}</p>}
    </div>
  );
};

export default EmptyState;
