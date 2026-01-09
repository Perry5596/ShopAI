import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/utils/supabase';
import { profileService } from '@/utils/supabase-service';
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch profile from database
  const fetchProfile = useCallback(async (userId: string, authUser: User) => {
    try {
      const dbProfile = await profileService.getProfile(userId);
      if (dbProfile) {
        setProfile(dbProfile);
      } else {
        // Fallback to metadata if no DB profile exists yet
        setProfile(extractUserProfileFromMetadata(authUser));
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      // Fallback to metadata on error
      setProfile(extractUserProfileFromMetadata(authUser));
    }
  }, []);

  // Public method to refresh profile (e.g., after stats update)
  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id, user);
    }
  }, [user, fetchProfile]);

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id, session.user);
      }
      setIsLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id, session.user);
        } else {
          setProfile(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
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
      setProfile(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value: AuthContextType = {
    user,
    session,
    profile,
    isLoading,
    isAuthenticated: !!session,
    signInWithGoogle,
    signInWithApple,
    signOut,
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
