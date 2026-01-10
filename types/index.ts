/**
 * Shop AI TypeScript Interfaces
 */

// Auth/User types
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  isPremium: boolean;
  // Lifetime stats (only go up, never down)
  totalShops: number;
  totalProducts: number;
  totalSavings: number; // in cents to avoid floating point issues
  createdAt?: string;
  updatedAt?: string;
}

// Legacy User type (alias for backwards compatibility)
export type User = UserProfile;

// Shop status type
export type ShopStatus = 'processing' | 'completed' | 'failed';

// Shop/Scan result types
export interface Shop {
  id: string;
  userId: string;
  imageUrl: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
  status: ShopStatus;
  savings: number; // in cents (average price - lowest price)
  sessionId?: string; // Link to search session for progressive updates
  products: ProductLink[];
  recommendation?: ProductLink;
}

export interface ProductLink {
  id: string;
  shopId: string;
  title: string;
  price: string;
  imageUrl?: string;
  affiliateUrl: string;
  source: string; // e.g., "Amazon", "Target", etc.
  isRecommended: boolean;
  rating?: number;
  reviewCount?: number;
}

// AI processing result schema (for snap feature)
export interface SnapResult {
  title: string;
  description?: string;
  products: Omit<ProductLink, 'id' | 'shopId'>[];
  recommendedIndex?: number; // index of recommended product in products array
}

// Database row types (snake_case from Supabase)
export interface DbShop {
  id: string;
  user_id: string;
  image_url: string;
  title: string;
  description: string | null;
  is_favorite: boolean;
  status: ShopStatus;
  savings: number;
  session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbProduct {
  id: string;
  shop_id: string;
  title: string;
  price: string;
  image_url: string | null;
  affiliate_url: string;
  source: string;
  is_recommended: boolean;
  rating: number | null;
  review_count: number | null;
  created_at: string;
}

export interface DbProfile {
  id: string;
  email: string | null;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_premium: boolean;
  total_shops: number;
  total_products: number;
  total_savings: number;
  created_at: string;
  updated_at: string;
}

// Settings types
export interface SettingsItem {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  isDestructive?: boolean;
  showChevron?: boolean;
  rightElement?: React.ReactNode;
}

export interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

// Camera types
export interface CameraState {
  isFlashOn: boolean;
  zoom: 0.5 | 1;
  isCapturing: boolean;
}

// Navigation param types
export type RootStackParamList = {
  index: undefined;
  '(app)/home': undefined;
  '(app)/profile': undefined;
  '(app)/snap': undefined;
  '(app)/shop/[id]': { id: string };
  '(app)/fix-issue/[id]': { id: string };
};

// Auth types
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
}

// ============================================================================
// Search Session Pipeline Types (Phase 0+)
// ============================================================================

// Session status through the pipeline
export type SessionStatus = 'identifying' | 'searching' | 'ranking' | 'completed' | 'failed';

// Store sources for retrieval
export type StoreSource = 'amazon' | 'target' | 'walmart' | 'bestbuy' | 'ebay';

// Store retrieval status
export type StoreStatus = 'pending' | 'success' | 'timeout' | 'error';

// Search session tracking
export interface SearchSession {
  id: string;
  shopId: string;
  userId: string;
  imageUrl: string;
  imageHash: string;
  status: SessionStatus;
  stageTimings: {
    createdAt: string;
    hypothesisAt?: string;
    firstResultAt?: string;
    rankingStartedAt?: string;
    completedAt?: string;
  };
  error?: string;
  createdAt: string;
  updatedAt: string;
}

// Product hypothesis from vision extraction
export interface ProductHypothesis {
  sessionId: string;
  productName: string;
  brand?: string;
  category: string;
  subcategory?: string;
  attributes: Record<string, string>;
  searchQueries: {
    strict: string;
    broad: string;
  };
  confidence: number;
  disambiguationNeeded: boolean;
  disambiguationOptions?: string[];
  rawVisionOutput?: string;
  createdAt: string;
}

// Individual product candidate from a store
export interface ProductCandidate {
  externalId: string;
  title: string;
  priceCents: number;
  priceDisplay: string;
  url: string;
  affiliateUrl: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  inStock: boolean;
  matchScore?: number;
}

// Store retrieval result
export interface StoreCandidate {
  sessionId: string;
  source: StoreSource;
  sourceStatus: StoreStatus;
  candidates: ProductCandidate[];
  queryUsed: string;
  responseTimeMs: number;
  errorMessage?: string;
  createdAt: string;
}

// Ranked product result
export interface RankedProduct {
  rank: number;
  source: string;
  externalId: string;
  title: string;
  priceDisplay: string;
  affiliateUrl: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  confidence: number;
  isRecommended: boolean;
  reasoning?: string;
}

// Final ranked results
export interface RankedResult {
  sessionId: string;
  rankedProducts: RankedProduct[];
  dedupedCount: number;
  totalCandidatesEvaluated: number;
  rankingModel: string;
  rankingTimeMs: number;
  createdAt: string;
}

// Session update event for progressive rendering
export interface SessionUpdate {
  sessionId: string;
  eventType: 'status_change' | 'hypothesis_ready' | 'store_result' | 'ranking_complete' | 'error';
  timestamp: string;
  payload: {
    status?: SessionStatus;
    hypothesis?: ProductHypothesis;
    storeResult?: StoreCandidate;
    rankedResults?: RankedResult;
    error?: string;
  };
}

// ============================================================================
// Database row types for Search Sessions (snake_case from Supabase)
// ============================================================================

export interface DbSearchSession {
  id: string;
  shop_id: string;
  user_id: string;
  image_url: string;
  image_hash: string;
  status: SessionStatus;
  stage_timings: {
    created_at: string;
    hypothesis_at?: string;
    first_result_at?: string;
    ranking_started_at?: string;
    completed_at?: string;
  };
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbSessionArtifact {
  id: string;
  session_id: string;
  artifact_type: 'hypothesis' | 'store_result' | 'ranked_result' | 'raw_llm_output';
  source: string | null;
  payload: Record<string, unknown>;
  duration_ms: number | null;
  created_at: string;
}
