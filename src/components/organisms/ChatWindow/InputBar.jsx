import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Smile, Send, Mic } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import IconButton from '../../atoms/IconButton';

export const InputBar = ({ onSend, onTyping }) => {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [text]);

  const handleChange = (e) => {
    setText(e.target.value);
    if (onTyping) onTyping(true);
  };

  const handleBlur = () => {
    if (onTyping) onTyping(false);
  };

  const handleSend = () => {
    if (text.trim()) {
      onSend(text.trim(), 'TEXT');
      setText('');
      if (onTyping) onTyping(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="px-4 py-3 bg-surface-primary border-t border-border flex items-end gap-2 z-10">
      <div className="flex gap-1 pb-1">
        <IconButton icon={Paperclip} className="text-text-muted" />
        <IconButton icon={Smile} className="text-text-muted hidden sm:flex" />
      </div>
      
      <div className="flex-1 bg-surface-secondary rounded-3xl border border-outline-variant/30 px-4 py-2 min-h-[44px] flex items-center">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="w-full bg-transparent border-none outline-none resize-none text-body-md text-text-primary placeholder:text-text-muted max-h-[120px] scrollbar-hide py-0.5"
        />
      </div>

      <div className="pb-1 pl-1">
        {text.trim() ? (
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={handleSend}
            className="w-11 h-11 rounded-full bg-accent text-on-accent flex items-center justify-center shadow-sm hover:bg-accent-hover transition-colors focus:outline-none"
          >
            <Send size={20} className="ml-1" />
          </motion.button>
        ) : (
          <IconButton icon={Mic} className="text-text-muted w-11 h-11" size={22} />
        )}
      </div>
    </div>
  );
};

export default InputBar;
