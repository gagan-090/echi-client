import React from 'react';
import { formatTime, formatDate } from '../../../lib/dateUtils';
import { cn } from '../../../lib/utils';

export const Timestamp = ({ date, type = 'time', className }) => {
  if (!date) return null;
  const display = type === 'time' ? formatTime(date) : formatDate(date);
  
  return (
    <span className={cn("text-[11px] font-label-sm tracking-wider uppercase text-text-muted", className)}>
      {display}
    </span>
  );
};

export default Timestamp;
