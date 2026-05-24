import React from 'react';
import { cn } from '../../../lib/utils';

export const TypingIndicator = ({ className }) => {
  return (
    <div className={cn("flex items-center gap-1 h-full px-1", className)}>
      <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce-dot" />
      <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce-dot" style={{ animationDelay: '0.15s' }} />
      <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce-dot" style={{ animationDelay: '0.3s' }} />
    </div>
  );
};

export default TypingIndicator;
