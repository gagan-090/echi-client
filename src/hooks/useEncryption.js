import { useState, useCallback } from 'react';
import { importKey } from '../lib/crypto';
import api from '../services/api';

const keyCache = new Map();

export const useEncryption = () => {
  const [loading, setLoading] = useState(false);

  const getConversationKey = useCallback(async (convId) => {
    if (keyCache.has(convId)) {
      return keyCache.get(convId);
    }
    
    setLoading(true);
    try {
      // Fetch key from API (simulated here)
      // const res = await api.get(`/conversations/${convId}/key`);
      // const keyBytes = res.data.key;
      // Mocking key for now
      const mockKeyStr = btoa('12345678901234567890123456789012'); // 32 bytes
      
      const cryptoKey = await importKey(mockKeyStr);
      keyCache.set(convId, cryptoKey);
      return cryptoKey;
    } catch (err) {
      console.error('Failed to get conversation key', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { getConversationKey, loading };
};
