import React from 'react';
import { cn } from '../../../lib/utils';
import { getInitials, getAvatarColor } from '../../../lib/avatarUtils';

export const Avatar = ({ src, name, userId, size = 'md', className, online }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-label-sm',
    md: 'w-10 h-10 text-label-md',
    lg: 'w-12 h-12 text-body-lg',
    xl: 'w-16 h-16 text-headline-md'
  };

  const colorClass = getAvatarColor(userId || name);

  return (
    <div className="relative inline-block">
      <div 
        className={cn(
          "rounded-full flex items-center justify-center overflow-hidden font-medium text-white flex-shrink-0",
          sizeClasses[size],
          !src && colorClass,
          className
        )}
      >
        {src ? (
          <img src={src} alt={name || 'Avatar'} className="w-full h-full object-cover" />
        ) : (
          <span>{getInitials(name)}</span>
        )}
      </div>
      {online && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-online border-2 border-surface-container-lowest rounded-full" />
      )}
    </div>
  );
};

export default Avatar;
