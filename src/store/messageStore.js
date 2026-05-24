import { create } from 'zustand';
import api from '../services/api';
import { useConversationStore } from './conversationStore';

export const useMessageStore = create((set, get) => ({
  messages: {}, // { [convId]: Message[] }
  loading: false,
  
  fetchMessages: async (convId, force = false) => {
    if (!force && get().messages[convId]) return; // Already fetched initially
    set({ loading: true });
    try {
      const { data } = await api.get(`/conversations/${convId}/messages`);
      set((state) => ({
        messages: { ...state.messages, [convId]: data.data.reverse() }
      }));
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      set({ loading: false });
    }
  },

  sendMessage: async (convId, content, senderId, type = 'text', fileData = null) => {
    // Optimistic UI update
    const tempId = `temp-${Date.now()}`;
    const tempMsg = {
      id: tempId,
      conversation_id: convId,
      sender_id: senderId,
      content,
      message_type: type,
      file_url: fileData?.url || null,
      is_deleted: false,
      sent_at: new Date().toISOString(),
      status: 'sending'
    };

    get().appendMessage(convId, tempMsg);

    try {
      const payload = { content, type, fileData };
      const { data } = await api.post(`/conversations/${convId}/messages`, payload);
      // Replace temp message with real one
      set((state) => ({
        messages: {
          ...state.messages,
          [convId]: state.messages[convId].map(m => 
            m.id === tempId ? { ...data.data, status: 'sent' } : m
          )
        }
      }));
      // Wait for backend to trigger update and fetch conversations for fresh preview
      setTimeout(() => {
        useConversationStore.getState().fetchConversations();
      }, 500);
    } catch (err) {
      // Mark as failed
      get().updateMsg(convId, tempId, { status: 'failed' });
    }
  },
  
  appendMessage: (convId, message) => set((state) => {
    const existing = state.messages[convId] || [];
    if (existing.find(m => m.id === message.id)) return state;
    return {
      messages: {
        ...state.messages,
        [convId]: [...existing, message]
      }
    };
  }),
  
  prependMessages: (convId, newMessages) => set((state) => ({
    messages: {
      ...state.messages,
      [convId]: [...newMessages, ...(state.messages[convId] || [])]
    }
  })),
  
  updateMsg: (convId, msgId, updates) => set((state) => ({
    messages: {
      ...state.messages,
      [convId]: (state.messages[convId] || []).map(m => 
        m.id === msgId ? { ...m, ...updates } : m
      )
    }
  })),

  clear: () => set({ messages: {} })
}));
