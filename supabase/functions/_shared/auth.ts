/**
 * Shared authentication utilities for Edge Functions
 * Handles both Supabase auth tokens and custom anonymous JWTs
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// ============================================================================
// Types
// ============================================================================

export interface AnonTokenPayload {
  typ: 'anon';
  sub: string; // anon_id (UUID)
  iat: number;
  exp: number;
}

export interface AuthResult {
  type: 'user' | 'anon';
  subject: string; // "user:<uuid>" or "anon:<uuid>"
  id: string; // The raw UUID
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_at: string | null;
  limit: number;
  used: number;
}

// ============================================================================
// JWT Utilities (for anonymous tokens)
// ============================================================================

/**
 * Base64URL encode a string
 */
function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Base64URL decode a string
 */
function base64UrlDecode(str: string): string {
  // Add padding if needed
  let padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  if (pad) {
    padded += '='.repeat(4 - pad);
  }
  return atob(padded);
}

/**
 * Create HMAC-SHA256 signature
 */
async function createHmacSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const signatureArray = new Uint8Array(signature);
  const signatureString = String.fromCharCode(...signatureArray);
  return base64UrlEncode(signatureString);
}

/**
 * Verify HMAC-SHA256 signature
 */
async function verifyHmacSignature(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expectedSignature = await createHmacSignature(data, secret);
  return signature === expectedSignature;
}

/**
 * Create a signed anonymous JWT
 */
export async function createAnonToken(
  anonId: string,
  secret: string,
  expiresInSeconds: number = 30 * 24 * 60 * 60 // 30 days
): Promise<{ token: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInSeconds;

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: AnonTokenPayload = {
    typ: 'anon',
    sub: anonId,
    iat: now,
    exp: exp,
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${headerEncoded}.${payloadEncoded}`;
  const signature = await createHmacSignature(dataToSign, secret);

  return {
    token: `${dataToSign}.${signature}`,
    expiresAt: exp,
  };
}

/**
 * Verify and decode an anonymous JWT
 * Returns the payload if valid, throws if invalid
 */
export async function verifyAnonToken(
  token: string,
  secret: string
): Promise<AnonTokenPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [headerEncoded, payloadEncoded, signature] = parts;
  const dataToVerify = `${headerEncoded}.${payloadEncoded}`;

  // Verify signature
  const isValid = await verifyHmacSignature(dataToVerify, signature, secret);
  if (!isValid) {
    throw new Error('Invalid token signature');
  }

  // Decode and parse payload
  let payload: AnonTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadEncoded));
  } catch {
    throw new Error('Invalid token payload');
  }

  // Verify token type
  if (payload.typ !== 'anon') {
    throw new Error('Invalid token type');
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new Error('Token expired');
  }

  return payload;
}

// ============================================================================
// Supabase Auth Verification
// ============================================================================

/**
 * Verify a Supabase access token and return the user ID
 */
export async function verifySupabaseToken(token: string): Promise<string> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration missing');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new Error('Invalid Supabase token');
  }

  return data.user.id;
}

// ============================================================================
// Request Authentication
// ============================================================================

/**
 * Resolve authentication from a request
 * Checks in order: Supabase auth, then anonymous token
 * Returns the authentication result with subject string
 */
export async function resolveAuth(req: Request): Promise<AuthResult> {
  const anonSecret = Deno.env.get('ANON_JWT_SECRET');
  if (!anonSecret) {
    throw new Error('ANON_JWT_SECRET not configured');
  }

  // 1. Check for Supabase Authorization header
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const userId = await verifySupabaseToken(token);
      return {
        type: 'user',
        subject: `user:${userId}`,
        id: userId,
      };
    } catch (error) {
      // Fall through to check anon token
      console.log('Supabase auth failed, checking anon token:', error);
    }
  }

  // 2. Check for anonymous token
  const anonToken = req.headers.get('X-Anon-Token');
  if (anonToken) {
    try {
      const payload = await verifyAnonToken(anonToken, anonSecret);
      return {
        type: 'anon',
        subject: `anon:${payload.sub}`,
        id: payload.sub,
      };
    } catch (error) {
      throw new Error(`Invalid anonymous token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 3. No valid authentication found
  throw new Error('Authentication required');
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Check and consume a rate limit token
 * Uses the atomic rate_limit_take function in Postgres
 */
export async function checkRateLimit(
  subject: string,
  limit: number = 14,
  windowSeconds: number = 604800 // 7 days
): Promise<RateLimitResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration missing');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase.rpc('rate_limit_take', {
    p_subject: subject,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow the request but log the error
    return {
      allowed: true,
      remaining: limit,
      reset_at: null,
      limit: limit,
      used: 0,
    };
  }

  return data as RateLimitResult;
}

/**
 * Check rate limit without consuming a token (read-only)
 */
export async function getRateLimitStatus(
  subject: string,
  limit: number = 14,
  windowSeconds: number = 604800
): Promise<RateLimitResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration missing');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase.rpc('rate_limit_check', {
    p_subject: subject,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error('Rate limit status check failed:', error);
    return {
      allowed: true,
      remaining: limit,
      reset_at: null,
      limit: limit,
      used: 0,
    };
  }

  return data as RateLimitResult;
}

// ============================================================================
// CORS Headers
// ============================================================================

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-anon-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse(
  data: unknown,
  status: number = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Create an error response
 */
export function errorResponse(
  message: string,
  status: number = 400,
  extra?: Record<string, unknown>
): Response {
  return jsonResponse({ error: message, ...extra }, status);
}
