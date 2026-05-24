import React from 'react';
import { cn } from '../../../lib/utils';

export const Badge = ({ count, className }) => {
  if (!count) return null;
  return (
    <span className={cn(
      "min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-accent text-on-accent text-label-sm font-bold",
      className
    )}>
      {count > 99 ? '99+' : count}
    </span>
  );
};

export default Badge;
