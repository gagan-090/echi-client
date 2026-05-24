import React from 'react';
import { cn } from '../../../lib/utils';
import Timestamp from '../../atoms/Timestamp';
import ReadReceipt from '../ReadReceipt';
import { MESSAGE_TYPES } from '../../../lib/constants';

const BubbleContainer = ({ isSent, isConsecutive, children, className }) => {
  return (
    <div className={cn(
      "flex flex-col max-w-[75%] md:max-w-[65%]",
      isSent ? "items-end" : "items-start",
      !isConsecutive && "mt-2",
      className
    )}>
      {children}
    </div>
  );
};

export const MessageBubble = ({ message, isSent, showAvatar, isConsecutive }) => {
  const isDeleted = message.type === MESSAGE_TYPES.DELETED;
  
  const bubbleClasses = cn(
    "relative px-4 py-2 text-body-md shadow-bubble",
    isSent 
      ? "bg-bubble-sent text-text-primary rounded-l-bubble rounded-tr-bubble" 
      : "bg-bubble-recv text-text-primary border border-border rounded-r-bubble rounded-tl-bubble",
    isConsecutive && isSent && "rounded-tr-md rounded-br-bubble",
    isConsecutive && !isSent && "rounded-tl-md rounded-bl-bubble",
    !isConsecutive && isSent && "rounded-br-sm",
    !isConsecutive && !isSent && "rounded-bl-sm",
    isDeleted && "italic text-text-muted bg-surface-secondary border-none shadow-none"
  );

  return (
    <div className={cn("flex w-full", isSent ? "justify-end" : "justify-start", isConsecutive ? "mt-1" : "mt-3")}>
      <BubbleContainer isSent={isSent} isConsecutive={isConsecutive}>
        <div className={bubbleClasses}>
          {isDeleted ? (
            "This message was deleted"
          ) : (
            message.decryptedContent || message.content
          )}
        </div>
        <div className={cn("flex items-center mt-1 px-1 gap-1", isSent ? "justify-end" : "justify-start")}>
          <Timestamp date={message.created_at || message.sent_at} />
          {isSent && <ReadReceipt status={message.status} />}
        </div>
      </BubbleContainer>
    </div>
  );
};

export default MessageBubble;
