import { create } from 'zustand';
import { shopService, storageService, profileService } from '@/utils/supabase-service';
import { analyzeImage } from '@/utils/mock-ai-service';
import { useShopStore } from './shopStore';
import type { Shop, UserProfile } from '@/types';

interface SnapState {
  isCapturing: boolean;
  isUploading: boolean;
  isProcessing: boolean;
  currentImageUri: string | null;
  error: string | null;

  // Actions
  captureAndProcess: (uri: string, userId: string, userProfile?: UserProfile | null) => Promise<string>;
  reset: () => void;
}

export const useSnapStore = create<SnapState>((set, get) => ({
  isCapturing: false,
  isUploading: false,
  isProcessing: false,
  currentImageUri: null,
  error: null,

  captureAndProcess: async (uri: string, userId: string, userProfile?: UserProfile | null): Promise<string> => {
    const shopStore = useShopStore.getState();

    set({
      isCapturing: true,
      isUploading: true,
      currentImageUri: uri,
      error: null,
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
      processImageInBackground(shopId, userId, imageUrl);

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

  reset: () => {
    set({
      isCapturing: false,
      isUploading: false,
      isProcessing: false,
      currentImageUri: null,
      error: null,
    });
  },
}));

/**
 * Process image in background using mock AI service.
 * This runs asynchronously after the user has navigated back to home.
 * Phase 0: Now passes shopId and userId for session tracking.
 */
async function processImageInBackground(shopId: string, userId: string, imageUrl: string): Promise<void> {
  const shopStore = useShopStore.getState();

  try {
    // Call the AI service with shop and user IDs for session tracking
    const result = await analyzeImage(imageUrl, shopId, userId);

    // Log session ID for debugging
    if (result.sessionId) {
      console.log(`[Shop ${shopId}] Processing completed with session: ${result.sessionId}`);
    }

    // Complete the shop processing with the results (also increments user stats)
    await shopStore.completeShopProcessing(shopId, userId, result);
  } catch (error) {
    console.error('Background image processing failed:', error);
    await shopStore.failShopProcessing(
      shopId,
      error instanceof Error ? error.message : 'Failed to analyze image'
    );
  }
}
