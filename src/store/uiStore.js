import { create } from 'zustand';

export const useUiStore = create((set) => ({
  theme: 'system',
  sidebarOpen: true,
  typingStatus: {}, // { [convId]: boolean }
  onlineUsers: [], // Array of active online user IDs
  broadcastTyping: async () => {}, // injected by useRealtime
  
  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setOnlineUsers: (users) => set({ onlineUsers: users }),
  
  setTyping: (convId, isTyping) => set((state) => ({
    typingStatus: { ...state.typingStatus, [convId]: isTyping }
  })),
  clearTyping: (convId) => set((state) => ({
    typingStatus: { ...state.typingStatus, [convId]: false }
  }))
}));
