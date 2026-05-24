import { create } from 'zustand';
import api from '../services/api';

export const useConversationStore = create((set, get) => ({
  conversations: [],
  activeConversationId: null,
  loading: false,
  error: null,
  
  fetchConversations: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get('/conversations');
      set({ conversations: data.data || [], error: null });
    } catch (err) {
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },
  
  setActive: (id) => set({ activeConversationId: id }),
  
  addConversation: (conv) => set((state) => {
    if (state.conversations.find(c => c.id === conv.id)) return state;
    return { conversations: [conv, ...state.conversations] };
  }),
  
  updateLastMsg: (convId, msg) => set((state) => ({
    conversations: state.conversations.map(c => 
      c.id === convId ? { 
        ...c, 
        last_message: msg, 
        updated_at: msg.created_at 
      } : c
    ).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
  })),
  
  clear: () => set({ conversations: [], activeConversationId: null })
}));
