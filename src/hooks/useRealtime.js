import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useConversationStore } from '../store/conversationStore';
import { useMessageStore } from '../store/messageStore';
import { useUiStore } from '../store/uiStore';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:4000';

let socketInstance = null;
export const getSocket = () => socketInstance;

export const useRealtime = () => {
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.accessToken);
  const updateLastMsg = useConversationStore(state => state.updateLastMsg);
  const setTyping = useUiStore(state => state.setTyping);
  const clearTyping = useUiStore(state => state.clearTyping);

  useEffect(() => {
    if (!user || !token) return;

    // Connect Socket.io with Auth Token
    const socket = io(SOCKET_URL, {
      auth: { token },
      withCredentials: true
    });

    socketInstance = socket;

    socket.on('connect', () => {
      console.log('⚡️ Connected to Socket.io for Realtime');
    });

    // 1. Listen for new messages routed through BullMQ/Redis
    socket.on('new_message', (payload) => {
      const { conversation_id } = payload;
      useMessageStore.getState().fetchMessages(conversation_id, true);
      useConversationStore.getState().fetchConversations();
      
      const currentActive = useConversationStore.getState().activeConversationId;
      if (currentActive === conversation_id) {
         import('../services/api').then(api => {
           api.default.patch(`/conversations/${conversation_id}/messages/read`).catch(console.error);
         });
      }
    });

    // Handle Read Receipts updates
    socket.on('messages_read', (payload) => {
      const { conversation_id } = payload;
      useMessageStore.getState().fetchMessages(conversation_id, true);
      useConversationStore.getState().fetchConversations();
    });

    // 2. Listen for Lightning-Fast Typing Indicators
    socket.on('typing_start', ({ conversationId, senderId }) => {
      setTyping(conversationId, true);
    });

    socket.on('typing_end', ({ conversationId, senderId }) => {
      setTyping(conversationId, false);
    });

    // Setup global broadcast for UI to dispatch
    let typingTimeout;
    const broadcastTyping = async (convId, isTyping, receiverId) => {
      if (!receiverId) return; // Need receiver to emit
      if (isTyping) {
        socket.emit('typing_start', { conversationId: convId, receiverId });
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
          socket.emit('typing_end', { conversationId: convId, receiverId });
          clearTyping(convId);
        }, 2000);
      } else {
        socket.emit('typing_end', { conversationId: convId, receiverId });
        clearTimeout(typingTimeout);
      }
    };

    useUiStore.setState({ broadcastTyping });

    return () => {
      socket.disconnect();
      socketInstance = null;
    };
  }, [user, token]);
};
