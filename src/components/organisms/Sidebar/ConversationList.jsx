import React from 'react';
import ConversationItem from '../../molecules/ConversationItem';
import { useConversationStore } from '../../../store/conversationStore';
import { useUiStore } from '../../../store/uiStore';

export const ConversationList = ({ conversations, loadMore, hasNextPage }) => {
  const activeConversationId = useConversationStore(state => state.activeConversationId);
  const setActive = useConversationStore(state => state.setActive);
  const typingUsers = useUiStore(state => state.typingUsers);
  const setSidebarOpen = useUiStore(state => state.setSidebarOpen);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 50 && hasNextPage && loadMore) {
      loadMore();
    }
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide bg-surface-primary" onScroll={handleScroll}>
      {conversations.map((conv) => {
        const isTyping = typingUsers[conv.id]?.length > 0;

        return (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            isActive={conv.id === activeConversationId}
            isTyping={isTyping}
            onClick={() => {
              setActive(conv.id);
              setSidebarOpen(false);
            }}
          />
        );
      })}
    </div>
  );
};

export default ConversationList;
