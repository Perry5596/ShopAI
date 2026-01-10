import type { SnapResult } from '@/types';
import { supabase } from './supabase';

/**
 * AI service that analyzes images using the analyze-product edge function.
 * Uses GPT-5 Nano with web search to identify products and find purchase links.
 */

/**
 * Analyzes an image and returns product recommendations with affiliate links.
 *
 * @param imageUrl - The URL of the image to analyze (must be publicly accessible)
 * @param additionalContext - Optional additional context from the user to help identify the product
 * @returns SnapResult with title, description, products, and recommended index
 *
 * @example
 * const result = await analyzeImage('https://example.com/photo.jpg');
 * // result.title = 'Nike Air Max 90'
 * // result.products = [{ title: 'Nike Air Max 90', price: '$129.99', affiliateUrl: '...', ... }]
 * // result.recommendedIndex = 0
 *
 * @example
 * // With additional context for reprocessing
 * const result = await analyzeImage('https://example.com/photo.jpg', 'This is actually an Adidas shoe, not Nike');
 */
export async function analyzeImage(imageUrl: string, additionalContext?: string): Promise<SnapResult> {
  console.log('Calling analyze-product edge function with imageUrl:', imageUrl, 'additionalContext:', additionalContext);
  
  const { data, error } = await supabase.functions.invoke('analyze-product', {
    body: { imageUrl, additionalContext },
  });

  console.log('Edge function response - data:', data, 'error:', error);

  if (error) {
    console.error('Edge function error:', error);
    // Try to get more details from the error
    const errorDetails = error.context?.body ? await error.context.body : error.message;
    console.error('Error details:', errorDetails);
    throw new Error(
      typeof errorDetails === 'string' ? errorDetails : (error.message || 'Failed to analyze image. Please try again.')
    );
  }

  // Check if the response contains an error from the edge function
  if (data?.error) {
    console.error('AI service error:', data.error);
    throw new Error(data.error);
  }

  // Validate the response has the expected shape
  if (!data || typeof data.title !== 'string') {
    console.error('Invalid response from AI service:', data);
    throw new Error('Invalid response from AI service');
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
