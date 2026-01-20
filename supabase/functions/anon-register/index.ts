/**
 * Anonymous Registration Edge Function
 *
 * Creates a new anonymous identity and returns a signed JWT.
 * This allows users to use the scan feature without signing in,
 * while still enforcing rate limits.
 *
 * POST /anon/register
 * Response: { token: string, expires_at: string, anon_id: string }
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createAnonToken, corsHeaders, jsonResponse, errorResponse } from '../_shared/auth.ts';

// Token expiry: 30 days
const TOKEN_EXPIRY_SECONDS = 30 * 24 * 60 * 60;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Get the secret for signing tokens
    const anonSecret = Deno.env.get('ANON_JWT_SECRET');
    if (!anonSecret) {
      console.error('ANON_JWT_SECRET not configured');
      return errorResponse('Server configuration error', 500);
    }

    // Generate a new anonymous ID (UUID v4)
    const anonId = crypto.randomUUID();

    // Create the signed JWT
    const { token, expiresAt } = await createAnonToken(
      anonId,
      anonSecret,
      TOKEN_EXPIRY_SECONDS
    );

    // Return the token to the client
    return jsonResponse({
      token,
      expires_at: new Date(expiresAt * 1000).toISOString(),
      anon_id: anonId,
    });
  } catch (error) {
    console.error('Error in anon-register:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
});
