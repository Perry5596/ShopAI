import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import {
  resolveAuth,
  corsHeaders,
  jsonResponse,
  errorResponse,
} from '../_shared/auth.ts';

/**
 * Upload Image Edge Function
 * 
 * Allows both authenticated users and anonymous guests to upload images.
 * Images are stored in Supabase Storage and a public URL is returned.
 * 
 * For guests, images are stored in an "anonymous/{anon_id}/" folder.
 * For authenticated users, images are stored in "{user_id}/" folder.
 */

// Maximum image size: 10MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // =========================================================================
    // Step 1: Authenticate the request
    // =========================================================================
    let auth;
    try {
      auth = await resolveAuth(req);
    } catch (error) {
      console.log('Authentication failed:', error);
      return errorResponse(
        'Authentication required',
        401,
        {
          code: 'auth_required',
          register_url: '/anon/register',
          message: 'Please sign in or register as a guest to upload images.',
        }
      );
    }

    // =========================================================================
    // Step 2: Parse request body (expect base64 image data)
    // =========================================================================
    const { imageData, contentType = 'image/jpeg' } = await req.json();

    if (!imageData) {
      return errorResponse('imageData is required (base64 encoded)', 400);
    }

    // Validate content type
    const validContentTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validContentTypes.includes(contentType)) {
      return errorResponse(
        `Invalid content type. Supported: ${validContentTypes.join(', ')}`,
        400
      );
    }

    // Decode base64 to binary
    let imageBytes: Uint8Array;
    try {
      // Handle data URL format (data:image/jpeg;base64,...)
      let base64Data = imageData;
      if (imageData.includes(',')) {
        base64Data = imageData.split(',')[1];
      }
      
      const binaryString = atob(base64Data);
      imageBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        imageBytes[i] = binaryString.charCodeAt(i);
      }
    } catch (error) {
      return errorResponse('Invalid base64 image data', 400);
    }

    // Check size
    if (imageBytes.length > MAX_IMAGE_SIZE) {
      return errorResponse(
        `Image too large. Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB`,
        400
      );
    }

    // =========================================================================
    // Step 3: Create Supabase client with service role for storage access
    // =========================================================================
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // =========================================================================
    // Step 4: Generate file path and upload
    // =========================================================================
    const timestamp = Date.now();
    const extension = contentType.split('/')[1] === 'jpeg' ? 'jpg' : contentType.split('/')[1];
    
    // Use different paths for users vs anonymous guests
    const folder = auth.type === 'user' ? auth.id : `anonymous/${auth.id}`;
    const filePath = `${folder}/${timestamp}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('shop-images')
      .upload(filePath, imageBytes, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return errorResponse(
        'Failed to upload image',
        500,
        { details: uploadError.message }
      );
    }

    // =========================================================================
    // Step 5: Get public URL
    // =========================================================================
    const { data: urlData } = supabase.storage
      .from('shop-images')
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      return errorResponse('Failed to generate public URL', 500);
    }

    // =========================================================================
    // Step 6: Return the public URL
    // =========================================================================
    return jsonResponse({
      success: true,
      imageUrl: urlData.publicUrl,
      path: filePath,
    });
  } catch (error) {
    console.error('Error in upload-image:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
});
