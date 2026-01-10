/**
 * Search Session Service
 *
 * Manages search session lifecycle for the staged pipeline.
 * Phase 0: Basic session creation and artifact logging.
 */

import { supabase } from './supabase';
import type {
  SearchSession,
  SessionStatus,
  DbSearchSession,
  DbSessionArtifact,
  ProductHypothesis,
  StoreCandidate,
  RankedResult,
} from '@/types';

// ============================================================================
// Type Converters
// ============================================================================

function dbSessionToSearchSession(dbSession: DbSearchSession): SearchSession {
  return {
    id: dbSession.id,
    shopId: dbSession.shop_id,
    userId: dbSession.user_id,
    imageUrl: dbSession.image_url,
    imageHash: dbSession.image_hash,
    status: dbSession.status,
    stageTimings: {
      createdAt: dbSession.stage_timings.created_at,
      hypothesisAt: dbSession.stage_timings.hypothesis_at,
      firstResultAt: dbSession.stage_timings.first_result_at,
      rankingStartedAt: dbSession.stage_timings.ranking_started_at,
      completedAt: dbSession.stage_timings.completed_at,
    },
    error: dbSession.error ?? undefined,
    createdAt: dbSession.created_at,
    updatedAt: dbSession.updated_at,
  };
}

// ============================================================================
// Image Hash Utility
// ============================================================================

/**
 * Generate a simple hash for an image URL.
 * In production, this would use perceptual hashing of the actual image content.
 * For now, we use a SHA-256 hash of the URL + timestamp for uniqueness.
 */
export async function generateImageHash(imageUrl: string): Promise<string> {
  // Use Web Crypto API to generate SHA-256 hash
  const encoder = new TextEncoder();
  const data = encoder.encode(imageUrl);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${hashHex.slice(0, 32)}`; // Truncate for readability
}

// ============================================================================
// Session Service
// ============================================================================

export const sessionService = {
  /**
   * Create a new search session for a shop
   */
  async createSession(
    shopId: string,
    userId: string,
    imageUrl: string
  ): Promise<SearchSession> {
    const imageHash = await generateImageHash(imageUrl);
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('search_sessions')
      .insert({
        shop_id: shopId,
        user_id: userId,
        image_url: imageUrl,
        image_hash: imageHash,
        status: 'identifying' as SessionStatus,
        stage_timings: { created_at: now },
      })
      .select()
      .single();

    if (error) throw error;
    return dbSessionToSearchSession(data as DbSearchSession);
  },

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<SearchSession | null> {
    const { data, error } = await supabase
      .from('search_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return dbSessionToSearchSession(data as DbSearchSession);
  },

  /**
   * Get session by shop ID
   */
  async getSessionByShopId(shopId: string): Promise<SearchSession | null> {
    const { data, error } = await supabase
      .from('search_sessions')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return dbSessionToSearchSession(data as DbSearchSession);
  },

  /**
   * Update session status and timings
   */
  async updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
    additionalTimings?: Partial<SearchSession['stageTimings']>,
    error?: string
  ): Promise<SearchSession> {
    // First get current timings
    const { data: current, error: fetchError } = await supabase
      .from('search_sessions')
      .select('stage_timings')
      .eq('id', sessionId)
      .single();

    if (fetchError) throw fetchError;

    const now = new Date().toISOString();
    const currentTimings = (current as DbSearchSession).stage_timings || {};

    // Merge timings
    const newTimings = {
      ...currentTimings,
      ...(additionalTimings && {
        hypothesis_at: additionalTimings.hypothesisAt,
        first_result_at: additionalTimings.firstResultAt,
        ranking_started_at: additionalTimings.rankingStartedAt,
        completed_at: additionalTimings.completedAt,
      }),
    };

    // Clean undefined values
    Object.keys(newTimings).forEach((key) => {
      if (newTimings[key as keyof typeof newTimings] === undefined) {
        delete newTimings[key as keyof typeof newTimings];
      }
    });

    const updateData: Record<string, unknown> = {
      status,
      stage_timings: newTimings,
      updated_at: now,
    };

    if (error !== undefined) {
      updateData.error = error;
    }

    const { data, error: updateError } = await supabase
      .from('search_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select()
      .single();

    if (updateError) throw updateError;
    return dbSessionToSearchSession(data as DbSearchSession);
  },

  /**
   * Check for cached session by image hash
   */
  async findCachedSession(imageHash: string): Promise<SearchSession | null> {
    const { data, error } = await supabase
      .from('search_sessions')
      .select('*')
      .eq('image_hash', imageHash)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return dbSessionToSearchSession(data as DbSearchSession);
  },
};

// ============================================================================
// Artifact Service
// ============================================================================

export const artifactService = {
  /**
   * Save a hypothesis artifact
   */
  async saveHypothesis(
    sessionId: string,
    hypothesis: ProductHypothesis,
    durationMs: number
  ): Promise<void> {
    const { error } = await supabase.from('session_artifacts').insert({
      session_id: sessionId,
      artifact_type: 'hypothesis',
      payload: hypothesis,
      duration_ms: durationMs,
    });

    if (error) throw error;
  },

  /**
   * Save a store result artifact
   */
  async saveStoreResult(
    sessionId: string,
    storeResult: StoreCandidate
  ): Promise<void> {
    const { error } = await supabase.from('session_artifacts').insert({
      session_id: sessionId,
      artifact_type: 'store_result',
      source: storeResult.source,
      payload: storeResult,
      duration_ms: storeResult.responseTimeMs,
    });

    if (error) throw error;
  },

  /**
   * Save ranked results artifact
   */
  async saveRankedResult(
    sessionId: string,
    rankedResult: RankedResult
  ): Promise<void> {
    const { error } = await supabase.from('session_artifacts').insert({
      session_id: sessionId,
      artifact_type: 'ranked_result',
      payload: rankedResult,
      duration_ms: rankedResult.rankingTimeMs,
    });

    if (error) throw error;
  },

  /**
   * Save raw LLM output for debugging
   */
  async saveRawLLMOutput(
    sessionId: string,
    output: string,
    source: string,
    durationMs: number
  ): Promise<void> {
    const { error } = await supabase.from('session_artifacts').insert({
      session_id: sessionId,
      artifact_type: 'raw_llm_output',
      source,
      payload: { raw_output: output },
      duration_ms: durationMs,
    });

    if (error) throw error;
  },

  /**
   * Get all artifacts for a session
   */
  async getArtifacts(sessionId: string): Promise<DbSessionArtifact[]> {
    const { data, error } = await supabase
      .from('session_artifacts')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data as DbSessionArtifact[]) || [];
  },

  /**
   * Get hypothesis artifact for a session
   */
  async getHypothesis(sessionId: string): Promise<ProductHypothesis | null> {
    const { data, error } = await supabase
      .from('session_artifacts')
      .select('payload')
      .eq('session_id', sessionId)
      .eq('artifact_type', 'hypothesis')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data?.payload as ProductHypothesis;
  },

  /**
   * Get store results for a session
   */
  async getStoreResults(sessionId: string): Promise<StoreCandidate[]> {
    const { data, error } = await supabase
      .from('session_artifacts')
      .select('payload')
      .eq('session_id', sessionId)
      .eq('artifact_type', 'store_result')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data?.map((d) => d.payload) as StoreCandidate[]) || [];
  },

  /**
   * Get ranked results for a session
   */
  async getRankedResult(sessionId: string): Promise<RankedResult | null> {
    const { data, error } = await supabase
      .from('session_artifacts')
      .select('payload')
      .eq('session_id', sessionId)
      .eq('artifact_type', 'ranked_result')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data?.payload as RankedResult;
  },
};
