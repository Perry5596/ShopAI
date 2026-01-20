import { create } from 'zustand';
import { shopService, storageService, profileService } from '@/utils/supabase-service';
import { analyzeImage, RateLimitError, AuthRequiredError } from '@/utils/mock-ai-service';
import { useShopStore } from './shopStore';
import { getAnonTokenString } from '@/utils/anon-auth';
import type { Shop, UserProfile, Identity, ScanResponse } from '@/types';

interface GuestScanResult {
  imageUri: string;
  result: ScanResponse;
  scannedAt: string;
}

interface SnapState {
  isCapturing: boolean;
  isUploading: boolean;
  isProcessing: boolean;
  currentImageUri: string | null;
  error: string | null;
  
  // Guest scan results (not persisted to database)
  guestScanResult: GuestScanResult | null;
  
  // Rate limit info from last scan
  lastRateLimitInfo: {
    remaining: number;
    limit: number;
    resetAt: string | null;
  } | null;

  // Actions
  captureAndProcess: (
    uri: string,
    identity: Identity,
    userProfile?: UserProfile | null
  ) => Promise<string | null>;
  captureAndProcessGuest: (uri: string, identity: Identity) => Promise<ScanResponse>;
  clearGuestResult: () => void;
  reset: () => void;
}

export const useSnapStore = create<SnapState>((set, get) => ({
  isCapturing: false,
  isUploading: false,
  isProcessing: false,
  currentImageUri: null,
  error: null,
  guestScanResult: null,
  lastRateLimitInfo: null,

  /**
   * Capture and process image for authenticated users
   * Creates a shop in the database and processes in background
   */
  captureAndProcess: async (
    uri: string,
    identity: Identity,
    userProfile?: UserProfile | null
  ): Promise<string | null> => {
    // For guests, use the guest flow instead
    if (identity.type === 'anon') {
      await get().captureAndProcessGuest(uri, identity);
      return null; // No shop ID for guests
    }

    const shopStore = useShopStore.getState();
    const userId = identity.id;

    set({
      isCapturing: true,
      isUploading: true,
      currentImageUri: uri,
      error: null,
      guestScanResult: null,
    });

    let shopId: string;
    let imageUrl: string;

    try {
      // Step 0: Ensure profile exists (for users who signed up before migration)
      const existingProfile = await profileService.getProfile(userId);
      if (!existingProfile) {
        await profileService.upsertProfile(userId, {
          email: userProfile?.email,
          name: userProfile?.name || 'User',
          avatarUrl: userProfile?.avatarUrl,
          isPremium: false,
        });
      }

      // Step 1: Create a placeholder shop in database with "processing" status
      const placeholderShop = await shopService.createShop(userId, {
        imageUrl: uri, // Temporary local URI, will be updated after upload
        title: 'Processing...',
        description: 'Analyzing your image...',
        status: 'processing',
      });

      shopId = placeholderShop.id;

      // Step 2: Add to local state immediately so UI shows it
      const newShop: Shop = {
        ...placeholderShop,
        products: [],
      };
      shopStore.addShop(newShop);

      // Step 3: Upload image to storage
      imageUrl = await storageService.uploadShopImage(userId, shopId, uri);

      // Step 4: Update shop with actual image URL
      await shopService.updateShop(shopId, { imageUrl });
      shopStore.updateShop(shopId, { imageUrl });

      set({ isUploading: false, isProcessing: true });

      // Step 5: Process image in background (don't await - let it run async)
      processImageInBackground(shopId, userId, imageUrl, identity);

      set({ isCapturing: false, isProcessing: false });

      return shopId;
    } catch (error) {
      console.error('Failed to capture and process image:', error);
      set({
        isCapturing: false,
        isUploading: false,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Failed to process image',
      });
      throw error;
    }
  },

  /**
   * Capture and process image for guest users
   * Does NOT persist to database - just analyzes and returns results
   */
  captureAndProcessGuest: async (uri: string, identity: Identity): Promise<ScanResponse> => {
    set({
      isCapturing: true,
      isUploading: true,
      isProcessing: false,
      currentImageUri: uri,
      error: null,
      guestScanResult: null,
    });

    try {
      let imageUrl = uri;
      
      // If it's a local file, upload via Edge Function first
      if (!uri.startsWith('http://') && !uri.startsWith('https://')) {
        // Get the anonymous token
        const anonToken = await getAnonTokenString();
        
        if (!anonToken) {
          throw new Error('No anonymous token available. Please restart the app.');
        }

        // Upload the image via the Edge Function
        imageUrl = await storageService.uploadImageViaEdge(uri, anonToken);
      }

      set({ isUploading: false, isProcessing: true });

      // Call the analyze endpoint with the public URL
      const result = await analyzeImage(imageUrl, identity);

      // Store rate limit info
      if (result.rateLimit) {
        set({
          lastRateLimitInfo: {
            remaining: result.rateLimit.remaining,
            limit: result.rateLimit.limit,
            resetAt: result.rateLimit.reset_at,
          },
        });
      }

      // Store guest result (use original local URI for display)
      const guestResult: GuestScanResult = {
        imageUri: uri,
        result,
        scannedAt: new Date().toISOString(),
      };

      set({
        isCapturing: false,
        isUploading: false,
        isProcessing: false,
        guestScanResult: guestResult,
      });

      return result;
    } catch (error) {
      console.error('Guest scan failed:', error);
      
      // Handle rate limit error specially
      if (error instanceof RateLimitError) {
        set({
          lastRateLimitInfo: {
            remaining: error.remaining,
            limit: error.limit,
            resetAt: error.resetAt,
          },
        });
      }

      set({
        isCapturing: false,
        isUploading: false,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Failed to process image',
      });
      throw error;
    }
  },

  clearGuestResult: () => {
    set({ guestScanResult: null });
  },

  reset: () => {
    set({
      isCapturing: false,
      isUploading: false,
      isProcessing: false,
      currentImageUri: null,
      error: null,
      guestScanResult: null,
    });
  },
}));

/**
 * Process image in background using AI service.
 * This runs asynchronously after the user has navigated back to home.
 */
async function processImageInBackground(
  shopId: string,
  userId: string,
  imageUrl: string,
  identity: Identity
): Promise<void> {
  const shopStore = useShopStore.getState();
  const snapStore = useSnapStore.getState();

  try {
    // Call the AI service
    const result = await analyzeImage(imageUrl, identity);

    // Store rate limit info
    if (result.rateLimit) {
      useSnapStore.setState({
        lastRateLimitInfo: {
          remaining: result.rateLimit.remaining,
          limit: result.rateLimit.limit,
          resetAt: result.rateLimit.reset_at,
        },
      });
    }

    // Complete the shop processing with the results (also increments user stats)
    await shopStore.completeShopProcessing(shopId, userId, result);
  } catch (error) {
    console.error('Background image processing failed:', error);

    // Handle rate limit error
    if (error instanceof RateLimitError) {
      useSnapStore.setState({
        lastRateLimitInfo: {
          remaining: error.remaining,
          limit: error.limit,
          resetAt: error.resetAt,
        },
      });
    }

    await shopStore.failShopProcessing(
      shopId,
      error instanceof Error ? error.message : 'Failed to analyze image'
    );
  }
}

// Re-export error types for convenience
export { RateLimitError, AuthRequiredError };
