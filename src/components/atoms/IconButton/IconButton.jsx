import React from 'react';
import { cn } from '../../../lib/utils';

export const IconButton = ({ icon: Icon, onClick, className, disabled, size = 24, variant = 'ghost' }) => {
  const variants = {
    ghost: "text-on-surface-variant hover:bg-surface-hover hover:text-on-surface",
    primary: "bg-accent text-on-accent hover:bg-accent-hover shadow-sm",
    danger: "text-danger hover:bg-danger/10"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-accent/50",
        variants[variant],
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <Icon size={size} />
    </button>
  );
};

export default IconButton;
