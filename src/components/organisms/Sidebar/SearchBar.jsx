import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SearchInput from '../../molecules/SearchInput';
import { useDebounce } from '../../../hooks/useDebounce';

export const SearchBar = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  React.useEffect(() => {
    if (onSearch) onSearch(debouncedQuery);
  }, [debouncedQuery, onSearch]);

  return (
    <div className="p-4 bg-surface-primary border-b border-border">
      <SearchInput 
        value={query} 
        onChange={setQuery} 
        placeholder="Search conversations..." 
      />
    </div>
  );
};

export default SearchBar;
