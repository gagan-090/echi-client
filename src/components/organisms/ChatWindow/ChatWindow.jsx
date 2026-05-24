import React from 'react';
import ChatHeader from './ChatHeader';
import MessageArea from './MessageArea';
import InputBar from './InputBar';
import EmptyState from '../../molecules/EmptyState';
import { useConversationStore } from '../../../store/conversationStore';
import { useMessageStore } from '../../../store/messageStore';
import { useAuthStore } from '../../../store/authStore';
import { useUiStore } from '../../../store/uiStore';

export const ChatWindow = () => {
  const activeConversationId = useConversationStore(state => state.activeConversationId);
  const conversations = useConversationStore(state => state.conversations);
  const messagesStore = useMessageStore(state => state.messages);
  const user = useAuthStore(state => state.user);
  const typingUsers = useUiStore(state => state.typingUsers);

  if (!activeConversationId) {
    return (
      <div className="hidden md:flex flex-1 bg-bg-primary items-center justify-center relative">
        <div className="fixed inset-0 grain-overlay z-0" />
        <EmptyState 
          title="Echo" 
          message="Select a conversation to start messaging" 
          className="z-10"
        />
      </div>
    );
  }

  const contact = conversations.find(c => c.id === activeConversationId);
  const messages = messagesStore[activeConversationId] || [];
  const isTyping = typingUsers[activeConversationId]?.length > 0;

  const handleSend = (content, type) => {
    // Implement send logic
    console.log('Sending message:', content);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-bg-primary relative overflow-hidden">
      <ChatHeader contact={contact} isTyping={isTyping} />
      <MessageArea 
        messages={messages} 
        currentUserId={user?.id}
        onLoadOlder={() => console.log('Load older')}
      />
      <InputBar 
        onSend={handleSend} 
        onTyping={(typing) => console.log('Typing:', typing)} 
      />
    </div>
  );
};

export default ChatWindow;
