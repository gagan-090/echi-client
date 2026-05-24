import React from 'react';
import { cn } from '../../../lib/utils';
import Avatar from '../../atoms/Avatar';
import Badge from '../../atoms/Badge';
import Timestamp from '../../atoms/Timestamp';
import TypingIndicator from '../TypingIndicator';

export const ConversationItem = ({ 
  conversation, 
  isActive, 
  onClick, 
  isTyping,
  style 
}) => {
  const { name, lastMessage, unreadCount, updated_at } = conversation;
  
  return (
    <div 
      style={style}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-l-4",
        isActive 
          ? "bg-accent-light border-accent" 
          : "border-transparent hover:bg-surface-hover"
      )}
    >
      <Avatar 
        name={name} 
        userId={conversation.participantId} 
        online={conversation.isOnline}
        size="lg"
      />
      
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex justify-between items-baseline mb-0.5">
          <h3 className="font-headline-md text-[16px] truncate">{name}</h3>
          <Timestamp date={updated_at} type="time" className="ml-2 flex-shrink-0" />
        </div>
        
        <div className="flex justify-between items-center">
          <div className="text-body-md text-text-secondary truncate pr-2 h-6 flex items-center">
            {isTyping ? (
              <TypingIndicator />
            ) : (
              <span className="truncate">{lastMessage?.content || "Start a conversation"}</span>
            )}
          </div>
          <Badge count={unreadCount} />
        </div>
      </div>
    </div>
  );
};

export default ConversationItem;
