import { create } from 'zustand';
import api from '../services/api';

export const useCallStore = create((set, get) => ({
  calls: [],
  loading: false,
  error: null,

  fetchCalls: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get('/calls');
      set({ calls: data.data || [], error: null });
    } catch (err) {
      console.error('Failed to fetch calls:', err);
      set({ error: err.message });
    } finally {
      set({ loading: false });
    }
  },

  logCall: async (callData) => {
    try {
      await api.post('/calls', callData);
      // Wait a moment for realtime event to propagate, then fetch fresh calls
      setTimeout(() => {
        get().fetchCalls();
      }, 500);
    } catch (err) {
      console.error('Failed to log call:', err);
    }
  }
}));
