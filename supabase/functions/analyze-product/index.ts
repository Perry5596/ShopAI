import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { appendAffiliateTag, getRetailerName } from './affiliate-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RETAILER_DOMAINS = ['amazon.com', 'ebay.com', 'target.com', 'bestbuy.com', 'walmart.com'];

// Interfaces
interface VisualMatch {
  position: number;
  title: string;
  link: string;
  source: string;
  source_icon?: string;
  thumbnail?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  image?: string;
  image_width?: number;
  image_height?: number;
  rating?: number;
  reviews?: number;
  price?: {
    value?: string;
    extracted_value?: number;
    currency?: string;
  };
}

interface SerpApiResponse {
  search_metadata?: {
    status: string;
  };
  visual_matches?: VisualMatch[];
  error?: string;
}

interface SnapResult {
  title: string;
  description?: string;
  products: Array<{
    title: string;
    price?: string;
    imageUrl?: string;
    affiliateUrl: string;
    source: string;
    isRecommended: boolean;
    rating?: number;
    reviewCount?: number;
  }>;
}

/**
 * Query SerpAPI Google Lens to find visual matches for an image.
 * @param imageUrl - The URL of the image to analyze
 * @param apiKey - SerpAPI API key
 * @param additionalContext - Optional additional context from user to refine search
 */
async function searchGoogleLens(
  imageUrl: string,
  apiKey: string,
  additionalContext?: string
): Promise<VisualMatch[]> {
  const url = new URL('https://serpapi.com/search');
  url.searchParams.set('engine', 'google_lens');
  url.searchParams.set('url', imageUrl);
  url.searchParams.set('api_key', apiKey);
  
  // Additional query context when user is refining results (fix issue feature)
  if (additionalContext?.trim()) {
    const searchQuery = additionalContext.trim();
    url.searchParams.set('q', searchQuery);
  }
  
  const response = await fetch(url.toString());

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SerpAPI error (${response.status}): ${errorText}`);
  }

  const data: SerpApiResponse = await response.json();

  if (data.error) {
    throw new Error(`SerpAPI error: ${data.error}`);
  }

  return data.visual_matches || [];
}

/**
 * Check if a source matches one of our retailer domains.
 * The source field from SerpAPI is like "Amazon.com", "eBay", "Target", etc.
 */
function matchesRetailerDomain(source: string, link: string): string | null {
  const sourceLower = source.toLowerCase();
  const linkLower = link.toLowerCase();

  for (const domain of RETAILER_DOMAINS) {
    // Check both the source text and the actual link URL
    const domainBase = domain.replace('.com', '');
    if (sourceLower.includes(domainBase) || linkLower.includes(domain)) {
      return domain;
    }
  }

  return null;
}

/**
 * Filter visual matches to only include retailer domains we support.
 * Returns all matching products sorted by position (lower = more accurate according to Google).
 * Multiple links per retailer are allowed.
 */
function filterAndPrioritizeMatches(matches: VisualMatch[]): VisualMatch[] {
  // Filter to only include matches from supported retailers
  const retailerMatches = matches.filter((match) => {
    return matchesRetailerDomain(match.source, match.link) !== null;
  });

  // Sort by position (ascending) - lower position = higher accuracy according to Google
  retailerMatches.sort((a, b) => a.position - b.position);

  return retailerMatches;
}

/**
 * Extract a display price from the SerpAPI price object or title.
 */
function extractPrice(match: VisualMatch): string | undefined {
  // First, try the structured price object from SerpAPI
  if (match.price?.value) {
    return match.price.value;
  }

  if (match.price?.extracted_value) {
    const currency = match.price.currency || '$';
    return `${currency}${match.price.extracted_value.toFixed(2)}`;
  }

  // Fallback: try to extract price from title
  const priceMatch = match.title.match(/\$[\d,]+\.?\d{0,2}/);
  if (priceMatch) {
    return priceMatch[0];
  }

  return undefined;
}

/**
 * Generate a product title from the first match or use a fallback.
 */
function generateProductTitle(matches: VisualMatch[]): string {
  if (matches.length === 0) {
    return 'Unknown Product';
  }

  // Use the first (most accurate) match's title, cleaned up
  const firstMatch = matches[0];
  let title = firstMatch.title;

  // Remove common suffixes like "- Amazon.com", "| eBay", etc.
  title = title
    .replace(/\s*[-|:]\s*(Amazon\.com|eBay|Target|Best Buy|Walmart).*$/i, '')
    .replace(/\s*\|\s*.*$/, '')
    .trim();

  // Truncate if too long
  if (title.length > 100) {
    title = title.substring(0, 97) + '...';
  }

  return title || 'Unknown Product';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageUrl, additionalContext } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'imageUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check required environment variable
    const serpApiKey = Deno.env.get('SERPAPI_KEY');
    if (!serpApiKey) {
      throw new Error('SERPAPI_KEY is not configured');
    }

    // Step 1: Query Google Lens via SerpAPI (with optional additional context for fix-issue)
    let visualMatches: VisualMatch[] = [];
    try {
      visualMatches = await searchGoogleLens(imageUrl, serpApiKey, additionalContext);
    } catch (error) {
      console.error('Google Lens search failed:', error);
      return new Response(
        JSON.stringify({
          title: 'Unknown Product',
          description: 'Unable to analyze the image. Please try again.',
          products: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Filter and prioritize matches by retailer domain
    const filteredMatches = filterAndPrioritizeMatches(visualMatches);

    // Step 3: Generate product title from the best match
    const productTitle = generateProductTitle(filteredMatches);

    // Step 4: Build the product list
    const products: SnapResult['products'] = filteredMatches.map((match, index) => ({
      title: match.title,
      price: extractPrice(match),
      imageUrl: match.image || match.thumbnail,
      affiliateUrl: appendAffiliateTag(match.link),
      source: getRetailerName(match.link),
      isRecommended: index === 0, // First match (lowest position) is recommended
      rating: match.rating,
      reviewCount: match.reviews,
    }));

    // Step 5: Build the response
    const snapResult: SnapResult = {
      title: productTitle,
      description: products.length > 0
        ? `Found ${products.length} product${products.length !== 1 ? 's' : ''} from verified retailers`
        : undefined,
      products,
    };

    return new Response(
      JSON.stringify(snapResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in analyze-product:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
