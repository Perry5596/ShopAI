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
  // Favorite stores
  favoriteAmazon?: boolean;
  favoriteTarget?: boolean;
  favoriteBestBuy?: boolean;
  favoriteWalmart?: boolean;
  favoriteEbay?: boolean;
  // Notification settings
  notificationsEnabled?: boolean;
  pushToken?: string;
  lastActivityAt?: string;
  // Streak tracking
  currentStreak?: number;
  lastActiveDate?: string;
  // Onboarding preferences
  country?: string;
  shoppingCategories?: string[];
  acquisitionSource?: string;
  acquisitionSourceOther?: string;
  onboardingCompleted?: boolean;
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
  products: ProductLink[];
  recommendation?: ProductLink;
}

export interface ProductLink {
  id: string;
  shopId: string;
  title: string;
  price?: string; // Optional - may not be available from search results
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
  created_at: string;
  updated_at: string;
}

export interface DbProduct {
  id: string;
  shop_id: string;
  title: string;
  price: string | null; // Nullable - may not be available from search results
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
  favorite_amazon: boolean | null;
  favorite_target: boolean | null;
  favorite_best_buy: boolean | null;
  favorite_walmart: boolean | null;
  favorite_ebay: boolean | null;
  // Notification settings
  notifications_enabled: boolean | null;
  push_token: string | null;
  last_activity_at: string | null;
  // Streak tracking
  current_streak: number | null;
  last_active_date: string | null;
  // Onboarding preferences
  country: string | null;
  shopping_categories: string[] | null;
  acquisition_source: string | null;
  acquisition_source_other: string | null;
  onboarding_completed: boolean | null;
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
  '(app)/search': undefined;
  '(app)/shop/[id]': { id: string };
  '(app)/fix-issue/[id]': { id: string };
};

// Auth types
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
}

// Rate limit types
export interface RateLimitStatus {
  canShop: boolean;
  shopsUsed: number;
  shopsRemaining: number;
  maxShops: number;
  windowStart: string | null;
  resetsAt: string | null;
}

export interface RateLimitIncrementResult {
  success: boolean;
  shopsUsed: number;
  shopsRemaining: number;
  maxShops: number;
  windowStart: string;
  resetsAt: string;
}

export interface DbShopRateLimit {
  id: string;
  user_id: string;
  window_start: string;
  shop_count: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Anonymous Authentication Types
// ============================================================================

// Identity type for API requests
export type IdentityType = 'user' | 'anon';

// User identity (authenticated)
export interface UserIdentity {
  type: 'user';
  id: string;
  subject: string; // "user:<uuid>"
  accessToken: string;
}

// Anonymous identity (guest)
export interface AnonIdentity {
  type: 'anon';
  id: string;
  subject: string; // "anon:<uuid>"
  anonToken: string;
}

// Union type for any identity
export type Identity = UserIdentity | AnonIdentity;

// Anonymous token payload (JWT claims)
export interface AnonTokenPayload {
  typ: 'anon';
  sub: string; // anon_id (UUID)
  iat: number;
  exp: number;
}

// ============================================================================
// Unified Rate Limit Types (for new rate_limits table)
// ============================================================================

export interface UnifiedRateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_at: string | null;
  limit: number;
  used: number;
}

// Scan response with rate limit info
export interface ScanResponse {
  title: string;
  description?: string;
  products: Omit<ProductLink, 'id' | 'shopId'>[];
  rateLimit?: {
    remaining: number;
    limit: number;
    reset_at: string | null;
  };
}

// Error response from Edge Functions
export interface ApiError {
  error: string;
  code?: string;
  message?: string;
  register_url?: string;
  remaining?: number;
  reset_at?: string | null;
  limit?: number;
  used?: number;
}

// ============================================================================
// Text Search (Agentic AI) Types
// ============================================================================

// Conversation status
export type ConversationStatus = 'active' | 'archived';

// Conversation (chat session for text search)
export interface Conversation {
  id: string;
  userId: string;
  title: string | null;
  status: ConversationStatus;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

// AI recommendation for a category
export interface ProductRecommendation {
  categoryLabel: string;
  productTitle: string;
  reason: string;
}

// Chat message (user or assistant)
export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: Record<string, unknown>;
  /** Categories attached to this assistant message (if any) */
  categories?: SearchCategory[];
  /** AI recommendations per category */
  recommendations?: ProductRecommendation[];
  /** Single follow-up question the AI asks */
  followUpQuestion?: string | null;
  /** Tappable answer options for the follow-up question */
  followUpOptions?: string[];
  /** @deprecated Use followUpQuestion + followUpOptions instead */
  suggestedQuestions?: string[];
  createdAt: string;
}

// AI-generated search category with products
export interface SearchCategory {
  id: string;
  conversationId: string;
  messageId: string;
  label: string;
  searchQuery: string;
  description: string | null;
  sortOrder: number;
  products: SearchProduct[];
  createdAt: string;
}

// Product from text search
export interface SearchProduct {
  id: string;
  categoryId: string;
  title: string;
  price: string | null;
  imageUrl: string | null;
  affiliateUrl: string;
  source: string;
  asin: string | null;
  rating: number | null;
  reviewCount: number | null;
  brand: string | null;
  isFavorite: boolean;
  createdAt: string;
}

// Search filters
export interface SearchFilters {
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'rating';
}

// Response from agent-search edge function
export interface AgentSearchResponse {
  conversationId: string;
  message: {
    id: string;
    role: 'assistant';
    content: string;
  };
  categories: Array<{
    id: string;
    label: string;
    description: string;
    products: Array<{
      id: string;
      title: string;
      price: string | null;
      image_url: string | null;
      affiliate_url: string;
      source: string;
      asin: string | null;
      rating: number | null;
      review_count: number | null;
      brand: string | null;
      category_id: string;
      created_at: string;
    }>;
  }>;
  suggestedQuestions: string[]; // deprecated
  recommendations?: Array<{ categoryLabel: string; productTitle: string; reason: string }>;
  followUpQuestion?: string | null;
  followUpOptions?: string[];
  rateLimit?: {
    remaining: number;
    limit: number;
    reset_at: string | null;
  };
}

// Database row types for text search (snake_case from Supabase)
export interface DbConversation {
  id: string;
  user_id: string;
  title: string | null;
  status: ConversationStatus;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DbSearchCategory {
  id: string;
  conversation_id: string;
  message_id: string;
  label: string;
  search_query: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface DbSearchProduct {
  id: string;
  category_id: string;
  title: string;
  price: string | null;
  image_url: string | null;
  affiliate_url: string;
  source: string;
  asin: string | null;
  rating: number | null;
  review_count: number | null;
  brand: string | null;
  is_favorite: boolean;
  created_at: string;
}

