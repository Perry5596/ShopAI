import { create } from 'zustand';
import { supabase } from '@/utils/supabase';
import type {
  SearchSession,
  ProductHypothesis,
  StoreCandidate,
  SessionStatus,
  StoreSource,
  StoreStatus,
} from '@/types';

interface SessionState {
  // Current session being tracked
  activeSession: SearchSession | null;
  hypothesis: ProductHypothesis | null;
  storeResults: StoreCandidate[];
  
  // Polling state
  isPolling: boolean;
  pollInterval: ReturnType<typeof setInterval> | null;
  
  // Actions
  startPolling: (sessionId: string) => void;
  stopPolling: () => void;
  fetchSession: (sessionId: string) => Promise<void>;
  reset: () => void;
  
  // Derived state helpers
  getStoreStatuses: () => Array<{
    source: string;
    status: StoreStatus;
    resultCount?: number;
  }>;
}

const POLL_INTERVAL_MS = 1000; // Poll every second
const ALL_STORES: StoreSource[] = ['amazon', 'target', 'walmart', 'bestbuy', 'ebay'];

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,
  hypothesis: null,
  storeResults: [],
  isPolling: false,
  pollInterval: null,

  startPolling: (sessionId: string) => {
    const { pollInterval, isPolling } = get();
    
    // Don't start if already polling
    if (isPolling || pollInterval) {
      return;
    }

    console.log(`[SessionStore] Starting polling for session ${sessionId}`);

    // Initial fetch
    get().fetchSession(sessionId);

    // Start polling
    const interval = setInterval(() => {
      const session = get().activeSession;
      
      // Stop polling if session is completed or failed
      if (session?.status === 'completed' || session?.status === 'failed') {
        console.log(`[SessionStore] Session ${sessionId} finished, stopping polling`);
        get().stopPolling();
        return;
      }

      get().fetchSession(sessionId);
    }, POLL_INTERVAL_MS);

    set({ pollInterval: interval, isPolling: true });
  },

  stopPolling: () => {
    const { pollInterval } = get();
    
    if (pollInterval) {
      clearInterval(pollInterval);
    }

    set({ pollInterval: null, isPolling: false });
  },

  fetchSession: async (sessionId: string) => {
    try {
      // Fetch session
      const { data: sessionData, error: sessionError } = await supabase
        .from('search_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError || !sessionData) {
        console.error('[SessionStore] Failed to fetch session:', sessionError);
        return;
      }

      const session: SearchSession = {
        id: sessionData.id,
        shopId: sessionData.shop_id,
        userId: sessionData.user_id,
        imageUrl: sessionData.image_url,
        imageHash: sessionData.image_hash,
        status: sessionData.status as SessionStatus,
        stageTimings: {
          createdAt: sessionData.stage_timings?.created_at || sessionData.created_at,
          hypothesisAt: sessionData.stage_timings?.hypothesis_at,
          firstResultAt: sessionData.stage_timings?.first_result_at,
          rankingStartedAt: sessionData.stage_timings?.ranking_started_at,
          completedAt: sessionData.stage_timings?.completed_at,
        },
        error: sessionData.error ?? undefined,
        createdAt: sessionData.created_at,
        updatedAt: sessionData.updated_at,
      };

      // Fetch artifacts
      const { data: artifacts } = await supabase
        .from('session_artifacts')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      let hypothesis: ProductHypothesis | null = null;
      const storeResults: StoreCandidate[] = [];

      if (artifacts) {
        for (const artifact of artifacts) {
          if (artifact.artifact_type === 'hypothesis') {
            hypothesis = artifact.payload as unknown as ProductHypothesis;
          } else if (artifact.artifact_type === 'store_result') {
            const storeResult = artifact.payload as unknown as StoreCandidate;
            storeResults.push(storeResult);
          }
        }
      }

      set({ activeSession: session, hypothesis, storeResults });
    } catch (error) {
      console.error('[SessionStore] Error fetching session:', error);
    }
  },

  reset: () => {
    get().stopPolling();
    set({
      activeSession: null,
      hypothesis: null,
      storeResults: [],
      isPolling: false,
      pollInterval: null,
    });
  },

  getStoreStatuses: () => {
    const { activeSession, storeResults } = get();
    
    // If session is completed, all stores are done
    if (activeSession?.status === 'completed') {
      return storeResults.map((r) => ({
        source: r.source,
        status: r.sourceStatus,
        resultCount: r.candidates?.length,
      }));
    }

    // Build status for all stores
    const resultsBySource = new Map(storeResults.map((r) => [r.source, r]));

    return ALL_STORES.map((source) => {
      const result = resultsBySource.get(source);
      
      if (result) {
        return {
          source,
          status: result.sourceStatus,
          resultCount: result.candidates?.length,
        };
      }

      // Store is pending if we're still searching
      if (activeSession?.status === 'searching' || activeSession?.status === 'identifying') {
        return { source, status: 'pending' as StoreStatus };
      }

      return { source, status: 'pending' as StoreStatus };
    });
  },
}));
