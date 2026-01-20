/**
 * Development Tools Utilities
 * 
 * Functions for clearing local storage and cache during development.
 * These should only be accessible in dev mode.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useSnapStore } from '@/stores/snapStore';
import { useProfileStore } from '@/stores/profileStore';
import { useShopStore } from '@/stores/shopStore';
import { clearAnonToken } from './anon-auth';
import { supabase } from './supabase';

/**
 * Clear all locally stored data
 * This includes:
 * - AsyncStorage (Supabase auth sessions)
 * - SecureStore (anonymous tokens)
 * - Zustand stores (in-memory state)
 */
export async function clearAllLocalData(): Promise<void> {
  try {
    // Clear AsyncStorage (used by Supabase for auth sessions)
    await AsyncStorage.clear();

    // Clear SecureStore (anonymous tokens)
    // Note: SecureStore doesn't have a clearAll method, so we clear known keys
    const secureStoreKeys = [
      'shop_ai_anon_token',
      'shop_ai_anon_id',
      'shop_ai_anon_expires',
    ];
    
    await Promise.all(
      secureStoreKeys.map((key) =>
        SecureStore.deleteItemAsync(key).catch((err) => {
          // Ignore errors for keys that don't exist
          console.warn(`Failed to delete SecureStore key ${key}:`, err);
        })
      )
    );

    // Also use the dedicated clear function for anonymous tokens
    await clearAnonToken().catch((err) => {
      console.warn('Failed to clear anonymous token:', err);
    });

    // Sign out from Supabase (clears session)
    await supabase.auth.signOut().catch((err) => {
      console.warn('Failed to sign out from Supabase:', err);
    });

    // Reset all Zustand stores
    useSnapStore.getState().reset();
    useProfileStore.getState().clearProfile();
    useShopStore.getState().reset();

    console.log('All local data cleared successfully');
  } catch (error) {
    console.error('Error clearing local data:', error);
    throw error;
  }
}
