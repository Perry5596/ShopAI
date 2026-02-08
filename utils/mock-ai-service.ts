import type { SnapResult, ScanResponse, Identity } from '@/types';
import { supabase } from './supabase';

/**
 * AI service that analyzes images using the analyze-product edge function.
 * Uses GPT-5 Nano with web search to identify products and find purchase links.
 */

// Custom error class for rate limiting
export class RateLimitError extends Error {
  remaining: number;
  resetAt: string | null;
  limit: number;
  isGuest: boolean;

  constructor(
    message: string,
    remaining: number,
    resetAt: string | null,
    limit: number,
    isGuest: boolean
  ) {
    super(message);
    this.name = 'RateLimitError';
    this.remaining = remaining;
    this.resetAt = resetAt;
    this.limit = limit;
    this.isGuest = isGuest;
  }
}

// Custom error class for authentication required
export class AuthRequiredError extends Error {
  registerUrl: string;

  constructor(message: string, registerUrl: string) {
    super(message);
    this.name = 'AuthRequiredError';
    this.registerUrl = registerUrl;
  }
}

/**
 * Analyzes an image and returns product recommendations with affiliate links.
 *
 * @param imageUrl - The URL of the image to analyze (must be publicly accessible)
 * @param identity - The user's identity (authenticated or anonymous)
 * @param additionalContext - Optional additional context from the user to help identify the product
 * @param country - ISO 3166-1 alpha-2 country code (e.g., 'US', 'GB') for location-aware results
 * @returns ScanResponse with title, description, products, and rate limit info
 *
 * @example
 * const result = await analyzeImage('https://example.com/photo.jpg', identity);
 * // result.title = 'Nike Air Max 90'
 * // result.products = [{ title: 'Nike Air Max 90', price: '$129.99', affiliateUrl: '...', ... }]
 * // result.rateLimit = { remaining: 13, limit: 14, reset_at: '2026-01-26T...' }
 */
export async function analyzeImage(
  imageUrl: string,
  identity: Identity,
  additionalContext?: string,
  country?: string
): Promise<ScanResponse> {
  console.log('Calling analyze-product edge function with imageUrl:', imageUrl, 'identity type:', identity.type);

  // Build headers based on identity type
  const headers: Record<string, string> = {};
  if (identity.type === 'anon') {
    headers['X-Anon-Token'] = identity.anonToken;
  }
  // Note: For authenticated users, supabase.functions.invoke automatically includes Authorization header

  const { data, error } = await supabase.functions.invoke('analyze-product', {
    body: { imageUrl, additionalContext, ...(country && { country }) },
    headers,
  });

  console.log('Edge function response - data:', JSON.stringify(data), 'error:', error?.message);

  // Helper function to check for rate limit and auth errors
  const checkForApiErrors = (errorData: Record<string, unknown> | null) => {
    if (!errorData) return;

    // Handle rate limit error (429)
    if (errorData.code === 'rate_limited') {
      throw new RateLimitError(
        (errorData.message as string) || 'Rate limit exceeded',
        (errorData.remaining as number) ?? 0,
        (errorData.reset_at as string) || null,
        (errorData.limit as number) ?? 14,
        identity.type === 'anon'
      );
    }

    // Handle auth required error (401)
    if (errorData.code === 'auth_required') {
      throw new AuthRequiredError(
        (errorData.message as string) || 'Authentication required',
        (errorData.register_url as string) || '/anon/register'
      );
    }
  };

  // Check if data contains error info (some versions return error body in data)
  if (data) {
    checkForApiErrors(data);
    
    // Check if there's an error property in data
    if (data.error) {
      console.error('AI service error in data:', data.error);
      throw new Error((data.error as string) || (data.message as string) || 'Unknown error');
    }
  }

  // If there's an error object from the client, try to extract error details from context
  if (error) {
    console.error('Edge function error:', error);
    
    // The error.context contains the Response object with the error body
    // We need to parse it to get rate limit / auth error details
    if (error.context && typeof error.context.json === 'function') {
      try {
        // Parse the error response body
        const errorData = await error.context.json();
        console.log('Parsed error context:', JSON.stringify(errorData));
        checkForApiErrors(errorData);
        
        // If there's a message in the error data, use it
        if (errorData?.message) {
          throw new Error(errorData.message);
        }
      } catch (parseError) {
        // If parseError is one of our custom errors, re-throw it
        if (parseError instanceof RateLimitError || parseError instanceof AuthRequiredError) {
          throw parseError;
        }
        // Otherwise log and continue to generic error handling
        console.error('Failed to parse error response:', parseError);
      }
    }
    
    throw new Error(error.message || 'Failed to analyze image. Please try again.');
  }

  // Validate the response has the expected shape
  if (!data || typeof data.title !== 'string') {
    console.error('Invalid response from AI service:', data);
    throw new Error('Invalid response from AI service');
  }

  return data as ScanResponse;
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use analyzeImage with identity parameter instead
 */
export async function analyzeImageLegacy(imageUrl: string, additionalContext?: string): Promise<SnapResult> {
  console.log('Warning: Using legacy analyzeImage without identity. This may fail for guests.');
  
  const { data, error } = await supabase.functions.invoke('analyze-product', {
    body: { imageUrl, additionalContext },
  });

  if (error) {
    throw new Error(error.message || 'Failed to analyze image');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as SnapResult;
}

/**
 * Simulates a failed AI analysis (for testing error states).
 * Use this to test how the app handles processing failures.
 */
export async function analyzeImageWithError(
  _imageUrl: string
): Promise<SnapResult> {
  throw new Error('AI service temporarily unavailable');
}
