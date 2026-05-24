import React from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import IconButton from '../../atoms/IconButton';

export const ScrollToBottom = ({ onClick }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 10 }}
      className="absolute bottom-4 right-4 md:right-8 z-20"
    >
      <div className="bg-surface-elevated rounded-full shadow-modal">
        <IconButton 
          icon={ChevronDown} 
          onClick={onClick}
          className="text-primary hover:bg-surface-hover"
        />
      </div>
    </motion.div>
  );
};

export default ScrollToBottom;
