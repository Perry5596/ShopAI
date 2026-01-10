import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/utils/supabase';
import { useProfileStore } from '@/stores';
import type { Session, User } from '@supabase/supabase-js';
import type { UserProfile } from '@/types';

// Ensure web browser auth sessions complete properly
WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Extract user profile from Supabase user metadata (fallback when DB profile doesn't exist)
function extractUserProfileFromMetadata(user: User | null): UserProfile | null {
  if (!user) return null;

  const metadata = user.user_metadata || {};
  
  return {
    id: user.id,
    email: user.email || metadata.email || '',
    name: metadata.full_name || metadata.name || 'User',
    avatarUrl: metadata.avatar_url || metadata.picture || undefined,
    isPremium: false,
    totalShops: 0,
    totalProducts: 0,
    totalSavings: 0,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Use stable zustand selector for profile (avoids re-renders from store object changes)
  const profile = useProfileStore((state) => state.profile);

  // Fetch profile from database in background (non-blocking)
  // Uses getState() to avoid dependency on store object which changes every render
  const fetchProfile = useCallback(async (userId: string, authUser: User, delayMs = 250) => {
    try {
      // Add delay to allow Supabase client to fully process session tokens
      // This fixes the race condition where onAuthStateChange fires before
      // the client is ready to make authenticated requests
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      // Use getState() for stable reference to store actions
      const store = useProfileStore.getState();
      const dbProfile = await store.fetchProfile(userId);

      // Only update if we got a valid profile (otherwise keep metadata)
      if (!dbProfile) {
        console.log('No DB profile found, keeping metadata profile');
      }
    } catch (error) {
      console.error('Failed to fetch profile from DB:', error);
      // Keep the metadata profile that was already set
    }
  }, []); // No dependencies - uses getState() for stable access

  // Public method to refresh profile (e.g., after stats update)
  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      // No delay needed for refresh since session is already established
      await fetchProfile(user.id, user, 0);
    }
  }, [user, fetchProfile]);

  // Initialize auth state
  useEffect(() => {
    let isMounted = true;

    // Get initial session
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Set immediate profile from metadata (no blocking)
          useProfileStore.getState().setProfile(extractUserProfileFromMetadata(session.user));
          // Then fetch full profile from DB in background (don't await)
          fetchProfile(session.user.id, session.user);
        }
      } catch (error) {
        console.error('Auth init error:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        if (!isMounted) return;

        // Skip INITIAL_SESSION since initAuth handles it
        if (event === 'INITIAL_SESSION') {
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Set immediate profile from metadata (no blocking)
          useProfileStore.getState().setProfile(extractUserProfileFromMetadata(session.user));
          // End loading state immediately - user is authenticated
          setIsLoading(false);
          // Then fetch full profile from DB in background (don't await)
          fetchProfile(session.user.id, session.user);
        } else {
          useProfileStore.getState().clearProfile();
          setIsLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Sign in with Google
  const signInWithGoogle = useCallback(async () => {
    try {
      setIsLoading(true);

      // Create the redirect URI for the OAuth callback
      const redirectUri = makeRedirectUri({
        scheme: 'shopai',
        path: 'auth/callback',
      });

      console.log('Redirect URI:', redirectUri);

      // Start the OAuth flow
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('OAuth error:', error);
        throw error;
      }

      if (data?.url) {
        // Open the OAuth URL in the browser
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUri
        );

        if (result.type === 'success' && result.url) {
          // Extract the tokens from the URL
          const url = new URL(result.url);
          const params = new URLSearchParams(url.hash.substring(1));
          
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken) {
            // Set the session with the tokens
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });

            if (sessionError) {
              console.error('Session error:', sessionError);
              throw sessionError;
            }

            console.log('Session set successfully');
          }
        }
      }
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sign in with Apple (placeholder for future implementation)
  const signInWithApple = useCallback(async () => {
    // TODO: Implement Apple Sign In
    console.log('Apple Sign In not yet implemented');
    throw new Error('Apple Sign In coming soon');
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      setSession(null);
      useProfileStore.getState().clearProfile();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Delete account - deletes all user data
  const deleteAccount = useCallback(async () => {
    try {
      setIsLoading(true);

      if (!user?.id) {
        throw new Error('No user logged in');
      }

      console.log('Deleting account data for user:', user.id);

      // 1. Delete user's storage files first
      try {
        const { data: files } = await supabase.storage
          .from('shop-images')
          .list(user.id);

        if (files && files.length > 0) {
          const filePaths = files.map((file) => `${user.id}/${file.name}`);
          const { error: storageError } = await supabase.storage.from('shop-images').remove(filePaths);
          if (storageError) {
            console.error('Storage deletion error:', storageError);
          } else {
            console.log(`Deleted ${filePaths.length} storage files`);
          }
        }
      } catch (storageError) {
        console.error('Storage deletion error (non-fatal):', storageError);
      }

      // 2. Delete all shops (products will cascade delete)
      const { error: shopsError } = await supabase
        .from('shops')
        .delete()
        .eq('user_id', user.id);

      if (shopsError) {
        console.error('Shops deletion error:', shopsError);
      } else {
        console.log('Deleted all shops and products');
      }

      // 3. Delete the profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (profileError) {
        console.error('Profile deletion error:', profileError);
        throw new Error(profileError.message || 'Failed to delete profile');
      }

      console.log('Successfully deleted account data');

      // 4. Sign out the user
      await supabase.auth.signOut();

      // 5. Clear local state
      setUser(null);
      setSession(null);
      useProfileStore.getState().clearProfile();
    } catch (error) {
      console.error('Delete account error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const value: AuthContextType = {
    user,
    session,
    profile,
    isLoading,
    isAuthenticated: !!session,
    signInWithGoogle,
    signInWithApple,
    signOut,
    deleteAccount,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
