import React, { useRef, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../../lib/utils';
import IconButton from '../../atoms/IconButton';
import ScrollToBottom from './ScrollToBottom';

export const MessageArea = ({ messages, currentUserId, onLoadOlder }) => {
  const scrollRef = useRef(null);
  const [showScroll, setShowScroll] = useState(false);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    
    // Show scroll-to-bottom button if not near bottom
    if (scrollHeight - scrollTop - clientHeight > 100) {
      setShowScroll(true);
    } else {
      setShowScroll(false);
    }

    // Load older messages if at top
    if (scrollTop === 0 && onLoadOlder) {
      onLoadOlder();
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    // Auto scroll to bottom on new messages if already at bottom
    if (!showScroll) {
      scrollToBottom();
    }
  }, [messages]);

  return (
    <div className="relative flex-1 overflow-hidden bg-bg-primary">
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="absolute inset-0 overflow-y-auto px-4 py-6 md:px-12 flex flex-col gap-1 scrollbar-hide"
      >
        {/* Grain overlay for texture */}
        <div className="fixed inset-0 grain-overlay pointer-events-none z-0" />
        
        <div className="relative z-10 flex flex-col">
          {messages.map((msg, idx) => {
            const isSent = msg.sender_id === currentUserId;
            const prevMsg = messages[idx - 1];
            const isConsecutive = prevMsg && prevMsg.sender_id === msg.sender_id;
            
            return (
              <React.Fragment key={msg.id}>
                {/* Date separator could go here if date differs from prevMsg */}
                <div className={cn("flex w-full", isSent ? "justify-end" : "justify-start", isConsecutive ? "mt-1" : "mt-4")}>
                  {/* Reuse MessageBubble here directly instead of MessageGroup for simplicity, or implement MessageGroup */}
                  <div className={cn(
                    "relative px-4 py-2 text-body-md shadow-bubble max-w-[75%]",
                    isSent 
                      ? "bg-bubble-sent text-text-primary rounded-l-bubble rounded-tr-bubble" 
                      : "bg-bubble-recv text-text-primary border border-border rounded-r-bubble rounded-tl-bubble",
                    isConsecutive && isSent && "rounded-tr-md rounded-br-bubble",
                    isConsecutive && !isSent && "rounded-tl-md rounded-bl-bubble",
                    !isConsecutive && isSent && "rounded-br-sm",
                    !isConsecutive && !isSent && "rounded-bl-sm"
                  )}>
                    {msg.content}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
      
      {showScroll && (
        <ScrollToBottom onClick={scrollToBottom} />
      )}
    </div>
  );
};

export default MessageArea;
