import React, { useState } from 'react';
import { cn } from '../../../lib/utils';

export const ImageMessage = ({ src, alt, className, onClick }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div 
      className={cn(
        "relative rounded-lg overflow-hidden cursor-pointer bg-surface-secondary mt-1 max-w-sm",
        className
      )}
      onClick={onClick}
    >
      {!isLoaded && (
        <div className="absolute inset-0 bg-surface-secondary animate-pulse" />
      )}
      <img
        src={src}
        alt={alt || "Image"}
        onLoad={() => setIsLoaded(true)}
        className={cn(
          "w-full h-auto max-h-[300px] object-cover transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
};

export default ImageMessage;
