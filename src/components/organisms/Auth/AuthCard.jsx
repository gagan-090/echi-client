import React from 'react';
import { cn } from '../../../lib/utils';

export const AuthCard = ({ children, className }) => {
  return (
    <div className={cn(
      "bg-surface-container-lowest rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-lg md:p-xl flex flex-col items-center w-full relative z-10",
      className
    )}>
      {children}
    </div>
  );
};

export default AuthCard;
