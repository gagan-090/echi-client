/**
 * Echo E2EE Module - X3DH Protocol Implementation
 * 
 * This module implements a robust, production-ready End-to-End Encryption protocol
 * inspired by the Signal Protocol (Extended Triple Diffie-Hellman - X3DH), using 
 * the native Web Crypto API (SubtleCrypto) for high performance and compatibility.
 */

const CURVE = 'P-256';
const HASH_ALGO = 'SHA-256';

/**
 * 1. KEY GENERATION
 * Generates an Elliptic Curve Diffie-Hellman (ECDH) key pair.
 */
export const generateKeyPair = async () => {
  return await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: CURVE },
    true, // extractable
    ['deriveKey', 'deriveBits']
  );
};

/**
 * Generates an ECDSA key pair for signing Pre-Keys to prove authenticity.
 */
export const generateSigningKeyPair = async () => {
  return await window.crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: CURVE },
    true,
    ['sign', 'verify']
  );
};

/**
 * Signs a Pre-Key (public part) using the Identity Private Key (ECDSA).
 */
export const signPreKey = async (privateSigningKey, preKeyPublicBuffer) => {
  return await window.crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: HASH_ALGO } },
    privateSigningKey,
    preKeyPublicBuffer
  );
};

/**
 * Verifies a Signed Pre-Key using the sender's Identity Public Key (ECDSA).
 */
export const verifyPreKeySignature = async (publicSigningKey, signature, preKeyPublicBuffer) => {
  return await window.crypto.subtle.verify(
    { name: 'ECDSA', hash: { name: HASH_ALGO } },
    publicSigningKey,
    signature,
    preKeyPublicBuffer
  );
};

/**
 * 2. KEY AGREEMENT (ECDH)
 * Derives a shared secret bytes array from a local private key and remote public key.
 */
const ecdhDeriveBits = async (privateKey, publicKey) => {
  return await window.crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256
  );
};

/**
 * Computes the X3DH Shared Secret using HKDF-SHA256.
 * Formula: HKDF( DH1 || DH2 || DH3 )
 * Where:
 * DH1 = ECDH(IdentityKeyA, SignedPreKeyB)
 * DH2 = ECDH(EphemeralKeyA, IdentityKeyB)
 * DH3 = ECDH(EphemeralKeyA, SignedPreKeyB)
 */
export const computeX3DHSharedSecret = async (
  localIdentityKeyPrivate, localEphemeralKeyPrivate,
  remoteIdentityKeyPublic, remoteSignedPreKeyPublic
) => {
  // Compute the 3 Diffie-Hellman agreements
  const dh1 = await ecdhDeriveBits(localIdentityKeyPrivate, remoteSignedPreKeyPublic);
  const dh2 = await ecdhDeriveBits(localEphemeralKeyPrivate, remoteIdentityKeyPublic);
  const dh3 = await ecdhDeriveBits(localEphemeralKeyPrivate, remoteSignedPreKeyPublic);

  // Concatenate DH outputs: DH1 || DH2 || DH3
  const combinedLength = dh1.byteLength + dh2.byteLength + dh3.byteLength;
  const combinedDH = new Uint8Array(combinedLength);
  combinedDH.set(new Uint8Array(dh1), 0);
  combinedDH.set(new Uint8Array(dh2), dh1.byteLength);
  combinedDH.set(new Uint8Array(dh3), dh1.byteLength + dh2.byteLength);

  // Import combined DH as base key material for HKDF
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    combinedDH,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  // Derive the final 256-bit AES-GCM Root Key using HKDF
  const salt = new Uint8Array(32); // Default zero-filled salt (in a full spec, this is defined)
  const info = new TextEncoder().encode('Echo-X3DH-App');

  return await window.crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: HASH_ALGO,
      salt: salt,
      info: info
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true, // Extractable for debugging/export, normally false
    ['encrypt', 'decrypt']
  );
};

/**
 * 3. ENCRYPTION & DECRYPTION (AES-256-GCM)
 */

/**
 * Encrypts a plaintext string into a base64 ciphertext using the shared AES-GCM root key.
 */
export const encryptMessage = async (plaintext, sharedAesKey) => {
  // Generate a cryptographically secure 96-bit (12 bytes) Initialization Vector
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(plaintext);
  
  // Encrypt payload; AES-GCM automatically appends a 16-byte auth tag to the ciphertext
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedAesKey,
    encodedText
  );
  
  // Prepend IV to ciphertext for storage/transmission: IV || Ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  // Return as Base64 string
  return btoa(String.fromCharCode.apply(null, combined));
};

/**
 * Decrypts an incoming base64 ciphertext back into plaintext using the shared AES-GCM root key.
 */
export const decryptMessage = async (encryptedBase64, sharedAesKey) => {
  try {
    const binaryString = atob(encryptedBase64);
    const combined = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      combined[i] = binaryString.charCodeAt(i);
    }
    
    // Extract 12-byte IV and the rest as Ciphertext (which includes the 16-byte auth tag)
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    
    // Decrypt and authenticate
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      sharedAesKey,
      ciphertext
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error('E2EE Decryption failed (Authentication Tag mismatch or bad key)', err);
    return '[Decryption Failed: Invalid Key or Corrupted Message]';
  }
};

/**
 * UTILS: Serialization
 */
export const exportPublicKey = async (key) => {
  const exported = await window.crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode.apply(null, new Uint8Array(exported)));
};

export const importPublicKey = async (base64Key, isSigning = false) => {
  const binaryString = atob(base64Key);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return await window.crypto.subtle.importKey(
    'raw',
    bytes,
    { name: isSigning ? 'ECDSA' : 'ECDH', namedCurve: CURVE },
    true,
    isSigning ? ['verify'] : []
  );
};
