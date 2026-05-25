import { useState, useCallback } from 'react';
import { 
  generateKeyPair, 
  generateSigningKeyPair, 
  signPreKey,
  computeX3DHSharedSecret,
  exportPublicKey
} from '../lib/e2ee';

const keyCache = new Map();

/**
 * useEncryption
 * Simulates a full X3DH Key Exchange for a given conversation.
 * In a real-world scenario, these public keys would be fetched from a Key Distribution Server.
 */
export const useEncryption = () => {
  const [loading, setLoading] = useState(false);

  const getConversationKey = useCallback(async (convId) => {
    if (keyCache.has(convId)) {
      return keyCache.get(convId);
    }
    
    setLoading(true);
    try {
      // 1. Generate Local Keys (Alice)
      const localIdentity = await generateKeyPair();
      const localEphemeral = await generateKeyPair();
      
      // 2. Generate Remote Keys (Bob - Mocked as if fetched from Server)
      const remoteIdentity = await generateKeyPair();
      const remoteSignedPreKey = await generateKeyPair();
      const remoteSigningKey = await generateSigningKeyPair();
      
      // Export remote public pre-key and sign it (simulating server payload)
      const preKeyPublicBuffer = await exportPublicKey(remoteSignedPreKey.publicKey);
      // const signature = await signPreKey(remoteSigningKey.privateKey, new TextEncoder().encode(preKeyPublicBuffer));
      // In production, Alice verifies `signature` using Bob's remoteSigningKey.publicKey
      
      // 3. X3DH Key Agreement
      // Alice derives the shared secret using her private keys and Bob's public keys
      const sharedSecretAesKey = await computeX3DHSharedSecret(
        localIdentity.privateKey,
        localEphemeral.privateKey,
        remoteIdentity.publicKey,
        remoteSignedPreKey.publicKey
      );
      
      keyCache.set(convId, sharedSecretAesKey);
      return sharedSecretAesKey;
    } catch (err) {
      console.error('Failed to run X3DH key exchange', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { getConversationKey, loading };
};
