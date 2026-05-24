import React from 'react';
import { cn } from '../../../lib/utils';

export const OnlineDot = ({ className }) => {
  return (
    <span className={cn(
      "w-2.5 h-2.5 bg-online rounded-full border-2 border-surface-container-lowest",
      className
    )} />
  );
};

export default OnlineDot;
