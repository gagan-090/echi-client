import React from 'react';
import { cn } from '../../../lib/utils';

export const DateSeparator = ({ date, className }) => {
  return (
    <div className={cn("flex justify-center my-4", className)}>
      <div className="bg-surface-secondary text-text-secondary px-3 py-1 rounded-full text-label-sm font-medium shadow-sm">
        {date}
      </div>
    </div>
  );
};

export default DateSeparator;
