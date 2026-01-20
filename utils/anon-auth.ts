/**
 * Anonymous Authentication Service
 *
 * Manages anonymous identity tokens for guest users.
 * Tokens are stored securely and used for rate-limited scan access.
 */

import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

// Storage keys
const ANON_TOKEN_KEY = 'shop_ai_anon_token';
const ANON_ID_KEY = 'shop_ai_anon_id';
const ANON_EXPIRES_KEY = 'shop_ai_anon_expires';

// Token refresh buffer: refresh 1 day before expiry
const REFRESH_BUFFER_MS = 24 * 60 * 60 * 1000;

export interface AnonTokenData {
  token: string;
  anonId: string;
  expiresAt: Date;
}

export interface AnonTokenPayload {
  typ: 'anon';
  sub: string;
  iat: number;
  exp: number;
}

/**
 * Decode a JWT payload without verification (for reading expiry)
 */
function decodeTokenPayload(token: string): AnonTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Base64URL decode the payload
    const payload = parts[1];
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Check if a token is expired or will expire soon
 */
function isTokenExpired(expiresAt: Date, bufferMs: number = 0): boolean {
  return new Date().getTime() + bufferMs >= expiresAt.getTime();
}

/**
 * Store anonymous token data securely
 */
async function storeTokenData(data: AnonTokenData): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ANON_TOKEN_KEY, data.token),
    SecureStore.setItemAsync(ANON_ID_KEY, data.anonId),
    SecureStore.setItemAsync(ANON_EXPIRES_KEY, data.expiresAt.toISOString()),
  ]);
}

/**
 * Retrieve stored anonymous token data
 */
async function getStoredTokenData(): Promise<AnonTokenData | null> {
  try {
    const [token, anonId, expiresStr] = await Promise.all([
      SecureStore.getItemAsync(ANON_TOKEN_KEY),
      SecureStore.getItemAsync(ANON_ID_KEY),
      SecureStore.getItemAsync(ANON_EXPIRES_KEY),
    ]);

    if (!token || !anonId || !expiresStr) {
      return null;
    }

    return {
      token,
      anonId,
      expiresAt: new Date(expiresStr),
    };
  } catch (error) {
    console.error('Error reading stored token:', error);
    return null;
  }
}

/**
 * Clear stored anonymous token data
 */
async function clearStoredTokenData(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ANON_TOKEN_KEY),
    SecureStore.deleteItemAsync(ANON_ID_KEY),
    SecureStore.deleteItemAsync(ANON_EXPIRES_KEY),
  ]);
}

/**
 * Register a new anonymous identity
 * Calls the /anon/register Edge Function
 */
export async function registerAnonymous(): Promise<AnonTokenData> {
  console.log('Registering new anonymous identity...');

  const { data, error } = await supabase.functions.invoke('anon-register', {
    method: 'POST',
    body: {},
  });

  if (error) {
    console.error('Anonymous registration failed:', error);
    throw new Error(
      `Failed to register anonymous identity: ${error.message || 'Unknown error'}`
    );
  }

  if (!data?.token || !data?.anon_id || !data?.expires_at) {
    console.error('Invalid response from anon-register:', data);
    throw new Error('Invalid response from anonymous registration');
  }

  const tokenData: AnonTokenData = {
    token: data.token,
    anonId: data.anon_id,
    expiresAt: new Date(data.expires_at),
  };

  // Store the token securely
  await storeTokenData(tokenData);

  console.log('Anonymous identity registered:', tokenData.anonId);
  return tokenData;
}

/**
 * Get the current anonymous token, registering if needed
 * Will refresh the token if it's expired or close to expiring
 */
export async function getAnonToken(): Promise<AnonTokenData | null> {
  const stored = await getStoredTokenData();

  if (!stored) {
    return null;
  }

  // Check if token needs refresh
  if (isTokenExpired(stored.expiresAt, REFRESH_BUFFER_MS)) {
    console.log('Anonymous token expired or expiring soon, refreshing...');
    try {
      return await registerAnonymous();
    } catch (error) {
      console.error('Failed to refresh anonymous token:', error);
      // If refresh fails, clear the expired token
      await clearStoredTokenData();
      return null;
    }
  }

  return stored;
}

/**
 * Ensure an anonymous token exists, registering if needed
 * This is the main entry point for guest mode initialization
 */
export async function ensureAnonToken(): Promise<AnonTokenData> {
  const existing = await getAnonToken();

  if (existing) {
    return existing;
  }

  return await registerAnonymous();
}

/**
 * Check if an anonymous token exists and is valid
 */
export async function hasValidAnonToken(): Promise<boolean> {
  const stored = await getStoredTokenData();

  if (!stored) {
    return false;
  }

  return !isTokenExpired(stored.expiresAt);
}

/**
 * Get the anonymous ID from the stored token
 */
export async function getAnonId(): Promise<string | null> {
  const stored = await getStoredTokenData();
  return stored?.anonId ?? null;
}

/**
 * Clear the anonymous token (e.g., when user signs in)
 */
export async function clearAnonToken(): Promise<void> {
  await clearStoredTokenData();
  console.log('Anonymous token cleared');
}

/**
 * Get the raw token string for API requests
 */
export async function getAnonTokenString(): Promise<string | null> {
  const stored = await getStoredTokenData();

  if (!stored || isTokenExpired(stored.expiresAt)) {
    return null;
  }

  return stored.token;
}
