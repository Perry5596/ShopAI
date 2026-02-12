import { useState, useEffect, useCallback } from 'react';
import {
  analyticsDataService,
  type AnalyticsRawData,
  type ShopAnalyticsRow,
  type ConversationAnalyticsRow,
  type ProductAnalyticsRow,
  type SearchProductAnalyticsRow,
} from '@/services/analyticsDataService';

// ============================================================================
// Time Range
// ============================================================================

export type TimeRange = '7D' | '30D' | '90D' | 'ALL';

function getStartDate(range: TimeRange): Date | null {
  if (range === 'ALL') return null;
  const now = new Date();
  const days = range === '7D' ? 7 : range === '30D' ? 30 : 90;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

// ============================================================================
// Processed Data Types
// ============================================================================

export interface HeroStatsData {
  currentStreak: number;
  totalSavings: number; // in dollars
  totalScans: number;
  linkClicks: number;
  textSearches: number;
}

export interface TimeSeriesPoint {
  label: string;
  value: number;
}

export interface StackedTimeSeriesPoint {
  label: string;
  scans: number;
  searches: number;
}

export interface RetailerSlice {
  name: string;
  count: number;
  color: string;
}

export interface PriceBucket {
  label: string;
  count: number;
}

export interface BrandCount {
  brand: string;
  count: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface ShoppingHabitsData {
  mostActiveDay: string;
  avgProductsPerScan: number;
  scanSuccessRate: number;
  favoriteRate: number;
}

export interface EngagementFunnelData {
  scans: number;
  productsFound: number;
  linksClicked: number;
  itemsSaved: number;
}

export interface ProcessedAnalytics {
  heroStats: HeroStatsData;
  savingsTimeSeries: TimeSeriesPoint[];
  activityTimeSeries: StackedTimeSeriesPoint[];
  retailerBreakdown: RetailerSlice[];
  priceDistribution: PriceBucket[];
  topBrands: BrandCount[];
  shoppingHabits: ShoppingHabitsData;
  categoryInsights: CategoryCount[];
  engagementFunnel: EngagementFunnelData;
  memberSince: string | null; // ISO date string
  hasShopData: boolean;
  hasSearchData: boolean;
}

// ============================================================================
// Color palette for retailers
// ============================================================================

const RETAILER_COLORS: Record<string, string> = {
  Amazon: '#FF9900',
  Target: '#CC0000',
  Walmart: '#0071CE',
  'Best Buy': '#0046BE',
  eBay: '#E53238',
};
const OTHER_COLOR = '#9CA3AF';

// ============================================================================
// Price parsing helper
// ============================================================================

function parsePriceToNumber(priceStr: string | null): number | null {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

// ============================================================================
// Time bucketing helpers
// ============================================================================

function formatDateLabel(date: Date, bucketSize: 'day' | 'week'): string {
  if (bucketSize === 'day') {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
  // Week label: show start of the week
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getDateKey(dateStr: string, bucketSize: 'day' | 'week'): string {
  const d = new Date(dateStr);
  if (bucketSize === 'day') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  // Week bucket: normalize to start of week (Sunday)
  const day = d.getDay();
  const diff = d.getDate() - day;
  const weekStart = new Date(d.getFullYear(), d.getMonth(), diff);
  return `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
}

function getBucketSize(range: TimeRange): 'day' | 'week' {
  return range === '7D' || range === '30D' ? 'day' : 'week';
}

function generateDateBuckets(
  range: TimeRange,
  bucketSize: 'day' | 'week'
): { key: string; label: string }[] {
  const buckets: { key: string; label: string }[] = [];
  const now = new Date();
  const start = getStartDate(range);

  if (!start) return []; // ALL range doesn't use pre-generated buckets

  const cursor = new Date(start);
  const step = bucketSize === 'day' ? 1 : 7;

  while (cursor <= now) {
    const key = getDateKey(cursor.toISOString(), bucketSize);
    const label = formatDateLabel(cursor, bucketSize);
    // Avoid duplicate keys
    if (buckets.length === 0 || buckets[buckets.length - 1].key !== key) {
      buckets.push({ key, label });
    }
    cursor.setDate(cursor.getDate() + step);
  }

  return buckets;
}

// ============================================================================
// Data processing functions
// ============================================================================

function processHeroStats(
  raw: AnalyticsRawData,
  profile: { currentStreak?: number; totalSavings?: number } | null
): HeroStatsData {
  return {
    currentStreak: profile?.currentStreak ?? 0,
    totalSavings: Math.round((profile?.totalSavings ?? 0) / 100),
    totalScans: raw.userAnalytics?.scan_count ?? raw.shops.length,
    linkClicks: raw.userAnalytics?.link_click_count ?? 0,
    textSearches: raw.userAnalytics?.text_search_count ?? 0,
  };
}

function processSavingsTimeSeries(
  shops: ShopAnalyticsRow[],
  range: TimeRange
): TimeSeriesPoint[] {
  const startDate = getStartDate(range);
  const filteredShops = startDate
    ? shops.filter((s) => new Date(s.created_at) >= startDate)
    : shops;

  if (filteredShops.length === 0) return [];

  const bucketSize = getBucketSize(range);

  if (range === 'ALL') {
    // For ALL range, dynamically determine buckets from data
    const bucketMap = new Map<string, number>();
    const labelMap = new Map<string, string>();
    let cumulative = 0;

    // First, add pre-start cumulative if filtering
    for (const shop of filteredShops) {
      const key = getDateKey(shop.created_at, bucketSize);
      const d = new Date(shop.created_at);
      cumulative += shop.savings;
      bucketMap.set(key, cumulative);
      labelMap.set(key, formatDateLabel(d, bucketSize));
    }

    return Array.from(bucketMap.entries()).map(([key, value]) => ({
      label: labelMap.get(key) || key,
      value: Math.round(value / 100), // Convert cents to dollars
    }));
  }

  // For fixed ranges, use pre-generated buckets
  const buckets = generateDateBuckets(range, bucketSize);
  const savingsByBucket = new Map<string, number>();
  let cumulative = 0;

  // Calculate pre-range cumulative for savings that happened before the range
  if (startDate) {
    for (const shop of shops) {
      if (new Date(shop.created_at) < startDate) {
        cumulative += shop.savings;
      }
    }
  }

  // Fill buckets with cumulative savings
  for (const shop of filteredShops) {
    const key = getDateKey(shop.created_at, bucketSize);
    cumulative += shop.savings;
    savingsByBucket.set(key, cumulative);
  }

  // Build time series maintaining cumulative values
  let lastValue = startDate
    ? Math.round(
        shops
          .filter((s) => new Date(s.created_at) < startDate)
          .reduce((sum, s) => sum + s.savings, 0) / 100
      )
    : 0;

  return buckets.map((bucket) => {
    const val = savingsByBucket.get(bucket.key);
    if (val !== undefined) {
      lastValue = Math.round(val / 100);
    }
    return { label: bucket.label, value: lastValue };
  });
}

function processActivityTimeSeries(
  shops: ShopAnalyticsRow[],
  conversations: ConversationAnalyticsRow[],
  range: TimeRange
): StackedTimeSeriesPoint[] {
  const startDate = getStartDate(range);
  const bucketSize = getBucketSize(range);

  const filteredShops = startDate
    ? shops.filter((s) => new Date(s.created_at) >= startDate)
    : shops;
  const filteredConvos = startDate
    ? conversations.filter((c) => new Date(c.created_at) >= startDate)
    : conversations;

  if (filteredShops.length === 0 && filteredConvos.length === 0) return [];

  if (range === 'ALL') {
    // Dynamically determine buckets from data
    const scansByBucket = new Map<string, number>();
    const searchesByBucket = new Map<string, number>();
    const labelMap = new Map<string, string>();

    for (const shop of filteredShops) {
      const key = getDateKey(shop.created_at, bucketSize);
      scansByBucket.set(key, (scansByBucket.get(key) || 0) + 1);
      labelMap.set(key, formatDateLabel(new Date(shop.created_at), bucketSize));
    }

    for (const conv of filteredConvos) {
      const key = getDateKey(conv.created_at, bucketSize);
      searchesByBucket.set(key, (searchesByBucket.get(key) || 0) + 1);
      labelMap.set(key, formatDateLabel(new Date(conv.created_at), bucketSize));
    }

    const allKeys = new Set([...scansByBucket.keys(), ...searchesByBucket.keys()]);
    return Array.from(allKeys)
      .sort()
      .map((key) => ({
        label: labelMap.get(key) || key,
        scans: scansByBucket.get(key) || 0,
        searches: searchesByBucket.get(key) || 0,
      }));
  }

  const buckets = generateDateBuckets(range, bucketSize);
  const scansByBucket = new Map<string, number>();
  const searchesByBucket = new Map<string, number>();

  for (const shop of filteredShops) {
    const key = getDateKey(shop.created_at, bucketSize);
    scansByBucket.set(key, (scansByBucket.get(key) || 0) + 1);
  }

  for (const conv of filteredConvos) {
    const key = getDateKey(conv.created_at, bucketSize);
    searchesByBucket.set(key, (searchesByBucket.get(key) || 0) + 1);
  }

  return buckets.map((bucket) => ({
    label: bucket.label,
    scans: scansByBucket.get(bucket.key) || 0,
    searches: searchesByBucket.get(bucket.key) || 0,
  }));
}

function processRetailerBreakdown(
  products: ProductAnalyticsRow[],
  searchProducts: SearchProductAnalyticsRow[]
): RetailerSlice[] {
  const counts = new Map<string, number>();

  for (const p of products) {
    const source = p.source || 'Other';
    counts.set(source, (counts.get(source) || 0) + 1);
  }
  for (const p of searchProducts) {
    const source = p.source || 'Other';
    counts.set(source, (counts.get(source) || 0) + 1);
  }

  if (counts.size === 0) return [];

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      color: RETAILER_COLORS[name] || OTHER_COLOR,
    }));
}

function processPriceDistribution(
  products: ProductAnalyticsRow[],
  searchProducts: SearchProductAnalyticsRow[]
): PriceBucket[] {
  const buckets = [
    { label: 'Under $25', min: 0, max: 25, count: 0 },
    { label: '$25 - $50', min: 25, max: 50, count: 0 },
    { label: '$50 - $100', min: 50, max: 100, count: 0 },
    { label: '$100 - $200', min: 100, max: 200, count: 0 },
    { label: '$200+', min: 200, max: Infinity, count: 0 },
  ];

  const allPrices = [
    ...products.map((p) => parsePriceToNumber(p.price)),
    ...searchProducts.map((p) => parsePriceToNumber(p.price)),
  ].filter((p): p is number => p !== null && p > 0);

  for (const price of allPrices) {
    for (const bucket of buckets) {
      if (price >= bucket.min && price < bucket.max) {
        bucket.count++;
        break;
      }
    }
  }

  return buckets.map(({ label, count }) => ({ label, count }));
}

function processTopBrands(
  searchProducts: SearchProductAnalyticsRow[]
): BrandCount[] {
  const counts = new Map<string, number>();

  for (const p of searchProducts) {
    if (p.brand && p.brand.trim()) {
      const brand = p.brand.trim();
      counts.set(brand, (counts.get(brand) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([brand, count]) => ({ brand, count }));
}

function processShoppingHabits(
  shops: ShopAnalyticsRow[],
  conversations: ConversationAnalyticsRow[],
  products: ProductAnalyticsRow[],
  searchProducts: SearchProductAnalyticsRow[],
  profile: { totalProducts?: number; totalShops?: number } | null
): ShoppingHabitsData {
  // Most active day of week
  const daysCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (const shop of shops) {
    const day = new Date(shop.created_at).getDay();
    daysCounts[day]++;
  }
  for (const conv of conversations) {
    const day = new Date(conv.created_at).getDay();
    daysCounts[day]++;
  }

  const maxDayIndex = daysCounts.indexOf(Math.max(...daysCounts));
  const mostActiveDay = daysCounts[maxDayIndex] > 0 ? dayNames[maxDayIndex] : 'N/A';

  // Average products per scan
  const totalShops = profile?.totalShops ?? shops.length;
  const totalProducts = profile?.totalProducts ?? 0;
  const avgProductsPerScan = totalShops > 0 ? totalProducts / totalShops : 0;

  // Scan success rate
  const completedShops = shops.filter((s) => s.status === 'completed').length;
  const scanSuccessRate = shops.length > 0 ? (completedShops / shops.length) * 100 : 0;

  // Favorite rate
  const totalFavProducts =
    products.filter((p) => p.is_favorite).length +
    searchProducts.filter((p) => p.is_favorite).length;
  const totalAllProducts = products.length + searchProducts.length;
  const favoriteRate = totalAllProducts > 0 ? (totalFavProducts / totalAllProducts) * 100 : 0;

  return {
    mostActiveDay,
    avgProductsPerScan: Math.round(avgProductsPerScan * 10) / 10,
    scanSuccessRate: Math.round(scanSuccessRate),
    favoriteRate: Math.round(favoriteRate * 10) / 10,
  };
}

function processCategoryInsights(
  categories: { label: string; created_at: string }[]
): CategoryCount[] {
  const counts = new Map<string, number>();

  for (const cat of categories) {
    if (cat.label && cat.label.trim()) {
      const label = cat.label.trim();
      counts.set(label, (counts.get(label) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([category, count]) => ({ category, count }));
}

function processEngagementFunnel(
  raw: AnalyticsRawData,
  profile: { totalProducts?: number; totalShops?: number } | null
): EngagementFunnelData {
  const scans = raw.userAnalytics?.scan_count ?? raw.shops.length;
  const productsFound = profile?.totalProducts ?? 0;
  const linksClicked = raw.userAnalytics?.link_click_count ?? 0;
  const itemsSaved =
    raw.products.filter((p) => p.is_favorite).length +
    raw.searchProducts.filter((p) => p.is_favorite).length;

  return { scans, productsFound, linksClicked, itemsSaved };
}

// ============================================================================
// Main Hook
// ============================================================================

interface UseAnalyticsDataResult {
  data: ProcessedAnalytics | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  savingsRange: TimeRange;
  setSavingsRange: (range: TimeRange) => void;
  activityRange: TimeRange;
  setActivityRange: (range: TimeRange) => void;
}

export function useAnalyticsData(
  userId: string | undefined,
  profile: {
    currentStreak?: number;
    totalSavings?: number;
    totalProducts?: number;
    totalShops?: number;
    createdAt?: string;
  } | null
): UseAnalyticsDataResult {
  const [rawData, setRawData] = useState<AnalyticsRawData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [savingsRange, setSavingsRange] = useState<TimeRange>('30D');
  const [activityRange, setActivityRange] = useState<TimeRange>('30D');

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    analyticsDataService
      .fetchAllAnalyticsData(userId)
      .then((data) => {
        if (!cancelled) {
          setRawData(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to fetch analytics data:', err);
          setError(err instanceof Error ? err.message : 'Failed to load analytics');
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  // Process data whenever raw data or ranges change
  const data = rawData
    ? processAll(rawData, profile, savingsRange, activityRange)
    : null;

  return {
    data,
    isLoading,
    error,
    refresh,
    savingsRange,
    setSavingsRange,
    activityRange,
    setActivityRange,
  };
}

function processAll(
  raw: AnalyticsRawData,
  profile: {
    currentStreak?: number;
    totalSavings?: number;
    totalProducts?: number;
    totalShops?: number;
    createdAt?: string;
  } | null,
  savingsRange: TimeRange,
  activityRange: TimeRange
): ProcessedAnalytics {
  return {
    heroStats: processHeroStats(raw, profile),
    savingsTimeSeries: processSavingsTimeSeries(raw.shops, savingsRange),
    activityTimeSeries: processActivityTimeSeries(raw.shops, raw.conversations, activityRange),
    retailerBreakdown: processRetailerBreakdown(raw.products, raw.searchProducts),
    priceDistribution: processPriceDistribution(raw.products, raw.searchProducts),
    topBrands: processTopBrands(raw.searchProducts),
    shoppingHabits: processShoppingHabits(
      raw.shops,
      raw.conversations,
      raw.products,
      raw.searchProducts,
      profile
    ),
    categoryInsights: processCategoryInsights(raw.searchCategories),
    engagementFunnel: processEngagementFunnel(raw, profile),
    memberSince: profile?.createdAt ?? null,
    hasShopData: raw.shops.length > 0,
    hasSearchData: raw.conversations.length > 0,
  };
}
