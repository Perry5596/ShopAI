import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/utils/supabase';
import { useProfileStore, useShopStore } from '@/stores';
import {
  ensureAnonToken,
  getAnonToken,
  getAnonTokenString,
  clearAnonToken,
  type AnonTokenData,
} from '@/utils/anon-auth';
import type { Session, User } from '@supabase/supabase-js';
import type { UserProfile, Identity } from '@/types';

// Ensure web browser auth sessions complete properly
WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  anonId: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  getIdentity: () => Promise<Identity>;
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
  const [anonId, setAnonId] = useState<string | null>(null);

  // Use stable zustand selector for profile (avoids re-renders from store object changes)
  const profile = useProfileStore((state) => state.profile);

  // Computed: is user a guest (has anon token but no session)
  const isGuest = !session && !!anonId;

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
        } else {
          // No session - check for existing anonymous token
          try {
            const anonToken = await getAnonToken();
            if (anonToken && isMounted) {
              setAnonId(anonToken.anonId);
              console.log('Restored anonymous identity:', anonToken.anonId);
            }
          } catch (error) {
            console.log('No existing anonymous token found');
          }
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

  // Sign in with Apple (native iOS only)
  const signInWithApple = useCallback(async () => {
    try {
      // Check platform - native Apple Sign-In only works on iOS
      if (Platform.OS !== 'ios') {
        throw new Error('Apple Sign In is only available on iOS devices');
      }

      // Check if Apple Sign-In is available on this device
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Apple Sign In is not available on this device');
      }

      setIsLoading(true);

      // Request Apple Sign-In credentials
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Ensure we have the identity token
      if (!credential.identityToken) {
        throw new Error('No identity token returned from Apple');
      }

      // Sign in to Supabase using the Apple identity token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) {
        console.error('Supabase Apple auth error:', error);
        throw error;
      }

      // Note: Apple only returns fullName on the FIRST sign-in
      // After that, we need to rely on what's stored in Supabase
      if (credential.fullName && data.user) {
        const fullName = [
          credential.fullName.givenName,
          credential.fullName.familyName,
        ]
          .filter(Boolean)
          .join(' ');

        // Update user metadata with the name if we received it
        if (fullName) {
          await supabase.auth.updateUser({
            data: { full_name: fullName },
          });
        }
      }

      console.log('Apple Sign In successful');
    } catch (error: any) {
      // Handle user cancellation gracefully
      if (error.code === 'ERR_REQUEST_CANCELED') {
        console.log('User cancelled Apple Sign In');
        return; // Don't throw, just return silently
      }
      console.error('Apple Sign In error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Continue as guest - registers an anonymous identity
  const continueAsGuest = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('Continuing as guest...');

      const tokenData = await ensureAnonToken();
      setAnonId(tokenData.anonId);

      console.log('Guest mode activated:', tokenData.anonId);
    } catch (error) {
      console.error('Failed to continue as guest:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get current identity for API requests
  // Returns subject string and type for use in scan requests
  const getIdentity = useCallback(async (): Promise<Identity> => {
    // If authenticated, use user ID
    if (session?.user) {
      return {
        type: 'user',
        id: session.user.id,
        subject: `user:${session.user.id}`,
        accessToken: session.access_token,
      };
    }

    // If guest, get anonymous token
    const anonToken = await getAnonTokenString();
    if (anonToken && anonId) {
      return {
        type: 'anon',
        id: anonId,
        subject: `anon:${anonId}`,
        anonToken,
      };
    }

    // No identity - need to register
    throw new Error('No identity available. Please sign in or continue as guest.');
  }, [session, anonId]);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Try to sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      // If there's an AuthSessionMissingError, the session was already invalidated
      // (e.g., logged in elsewhere, expired, etc.) - that's fine, just clear local state
      if (error && error.name !== 'AuthSessionMissingError') {
        throw error;
      }
      
      // Always clear local state regardless of whether Supabase had an active session
      setUser(null);
      setSession(null);
      useProfileStore.getState().clearProfile();
      useShopStore.getState().reset();
      
      // Note: We don't clear the anonymous token here
      // User can still use the app as guest after signing out
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

      // 4. Sign out the user (ignore session missing error since we're deleting anyway)
      try {
        await supabase.auth.signOut();
      } catch (signOutError: any) {
        // Ignore AuthSessionMissingError - session may already be invalid
        if (signOutError?.name !== 'AuthSessionMissingError') {
          console.error('Sign out during delete error:', signOutError);
        }
      }

      // 5. Clear local state
      setUser(null);
      setSession(null);
      useProfileStore.getState().clearProfile();
      useShopStore.getState().reset();
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
    isGuest,
    anonId,
    signInWithGoogle,
    signInWithApple,
    signOut,
    deleteAccount,
    refreshProfile,
    continueAsGuest,
    getIdentity,
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
