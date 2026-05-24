import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../../lib/utils';

export const SearchInput = ({ value, onChange, placeholder = 'Search...', className }) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className={cn(
      "relative flex items-center w-full h-10 bg-surface-secondary rounded-full transition-all border",
      isFocused ? "border-accent ring-1 ring-accent/20" : "border-transparent",
      className
    )}>
      <div className="pl-3 pr-2 text-text-muted">
        <Search size={18} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-none outline-none text-body-md text-text-primary placeholder:text-text-muted"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="pr-3 pl-2 text-text-muted hover:text-text-primary outline-none"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

export default SearchInput;
