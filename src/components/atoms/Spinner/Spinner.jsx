import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

export const Spinner = ({ size = 'md', className, color = 'text-accent' }) => {
  const sizes = {
    sm: 16,
    md: 24,
    lg: 32
  };
  
  return (
    <Loader2 
      size={sizes[size]} 
      className={cn("animate-spin", color, className)} 
    />
  );
};

export default Spinner;
