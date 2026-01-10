import { create } from 'zustand';
import { profileService } from '@/utils/supabase-service';
import type { UserProfile } from '@/types';

interface ProfileState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setProfile: (profile: UserProfile | null) => void;
  fetchProfile: (userId: string) => Promise<UserProfile | null>;
  updateProfile: (userId: string, updates: Partial<Omit<UserProfile, 'id'>>) => Promise<void>;
  clearProfile: () => void;
}

/**
 * Fetch profile with retry logic for handling transient failures.
 * Exponential backoff is applied ONLY on retries (not the first attempt).
 */
async function fetchProfileWithRetry(
  userId: string,
  maxRetries = 3,
  baseDelayMs = 200
): Promise<UserProfile | null> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Only add delay on retry attempts (not the first attempt)
      if (attempt > 0) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1); // 200ms, 400ms
        console.log(`Profile fetch retry ${attempt}, waiting ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const profile = await profileService.getProfile(userId);
      return profile;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.warn(`Profile fetch attempt ${attempt + 1} failed:`, error);

      // If this is the last attempt, throw the error
      if (attempt === maxRetries - 1) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Failed to fetch profile after retries');
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  isLoading: false,
  error: null,

  setProfile: (profile: UserProfile | null) => {
    set({ profile, error: null });
  },

  fetchProfile: async (userId: string): Promise<UserProfile | null> => {
    set({ isLoading: true, error: null });

    try {
      const profile = await fetchProfileWithRetry(userId);
      set({ profile, isLoading: false });
      return profile;
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch profile',
        isLoading: false,
      });
      return null;
    }
  },

  updateProfile: async (userId: string, updates: Partial<Omit<UserProfile, 'id'>>) => {
    try {
      const updatedProfile = await profileService.upsertProfile(userId, updates);
      set({ profile: updatedProfile, error: null });
    } catch (error) {
      console.error('Failed to update profile:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to update profile',
      });
      throw error;
    }
  },

  clearProfile: () => {
    set({ profile: null, isLoading: false, error: null });
  },
}));
