import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { appendAffiliateTag, getRetailerName } from './affiliate-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CSE_ID = 'f7e9904bb10464c17';
const RETAILER_DOMAINS = ['amazon.com', 'ebay.com', 'target.com', 'bestbuy.com', 'walmart.com'];

// Interfaces
interface ProductIdentification {
  brand: string;
  name: string;
  color: string;
  model: string;
  searchQuery: string;
}

interface CSEResult {
  title: string;
  link: string;
  snippet?: string;
  displayLink: string;
}

interface SnapResult {
  title: string;
  description?: string;
  products: Array<{
    title: string;
    price?: string;
    affiliateUrl: string;
    source: string;
    isRecommended: boolean;
  }>;
}

/**
 * Extract price from CSE result title or snippet.
 * Looks for common price patterns like $99.99, $1,299.00, etc.
 */
function extractPrice(result: CSEResult): string | undefined {
  const text = `${result.title} ${result.snippet || ''}`;
  
  // Match price patterns: $X, $X.XX, $X,XXX.XX, etc.
  // Also handles "from $X" or "starting at $X"
  const pricePatterns = [
    /\$[\d,]+\.?\d{0,2}/g,  // $99, $99.99, $1,299.00
  ];
  
  for (const pattern of pricePatterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      // Return the first (usually most relevant) price found
      // Clean up the price format
      const price = matches[0];
      // Validate it's a reasonable price (not like $0 or $0.00)
      const numericValue = parseFloat(price.replace(/[$,]/g, ''));
      if (numericValue > 0) {
        return price;
      }
    }
  }
  
  return undefined;
}

/**
 * Step 1: Use LLM vision to identify the product from the image.
 * Returns structured product info including an optimized search query.
 */
async function identifyProduct(
  imageUrl: string,
  additionalContext: string | undefined,
  apiKey: string
): Promise<ProductIdentification> {
  const userText = additionalContext?.trim()
    ? `Identify this product. Context: ${additionalContext.trim()}`
    : 'Identify this product.';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content:
            'Identify the product in the image. Return JSON only: {"brand":"","name":"","color":"","model":"","searchQuery":"optimized search string for finding this product online"}. The searchQuery should be concise but specific enough to find the exact product.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorData}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Parse JSON from response (handle markdown code blocks)
  let jsonStr = content;
  const match =
    content.match(/```json\s*([\s\S]*?)\s*```/) ||
    content.match(/```\s*([\s\S]*?)\s*```/) ||
    content.match(/\{[\s\S]*"searchQuery"[\s\S]*\}/);
  if (match) jsonStr = match[1] || match[0];

  return JSON.parse(jsonStr.trim());
}

/**
 * Step 2: Query Google Custom Search API to find product links.
 */
async function searchProducts(query: string, apiKey: string): Promise<CSEResult[]> {
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', GOOGLE_CSE_ID);
  url.searchParams.set('q', query);
  url.searchParams.set('num', '10');

  const response = await fetch(url.toString());

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Google CSE API error (${response.status}): ${errorData}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Step 3: Select the best (first) result for each retailer domain.
 * Google CSE returns results ranked by relevance, so first match per domain is best.
 */
function selectBestPerRetailer(results: CSEResult[]): Map<string, CSEResult> {
  const selected = new Map<string, CSEResult>();

  for (const result of results) {
    try {
      const hostname = new URL(result.link).hostname.replace('www.', '').toLowerCase();
      const retailer = RETAILER_DOMAINS.find((r) => hostname.includes(r));

      if (retailer && !selected.has(retailer)) {
        selected.set(retailer, result);
      }
    } catch {
      // Skip invalid URLs
      continue;
    }
  }

  return selected;
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

    // Check required environment variables
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!googleApiKey) {
      throw new Error('GOOGLE_API_KEY is not configured');
    }

    // Step 1: Identify the product using LLM vision
    let productInfo: ProductIdentification;
    try {
      productInfo = await identifyProduct(imageUrl, additionalContext, openaiApiKey);
    } catch (error) {
      console.error('Product identification failed:', error);
      return new Response(
        JSON.stringify({
          title: 'Unknown Product',
          description: 'Unable to identify the product in the image.',
          products: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Search for products using Google Custom Search
    let searchResults: CSEResult[] = [];
    try {
      searchResults = await searchProducts(productInfo.searchQuery, googleApiKey);
    } catch (error) {
      console.error('Google CSE search failed:', error);
      // Continue with empty results - we can still return the product identification
    }

    // Step 3: Select best result per retailer
    const selectedProducts = selectBestPerRetailer(searchResults);

    // Step 4: Build response with affiliate tags
    const productTitle = productInfo.brand && productInfo.name
      ? `${productInfo.brand} ${productInfo.name}`
      : productInfo.name || productInfo.searchQuery;

    const description = [productInfo.color, productInfo.model]
      .filter(Boolean)
      .join(' - ') || undefined;

    const products: SnapResult['products'] = [];
    let isFirst = true;

    for (const [, result] of selectedProducts) {
      const price = extractPrice(result);
      products.push({
        title: result.title,
        price,
        affiliateUrl: appendAffiliateTag(result.link),
        source: getRetailerName(result.link),
        isRecommended: isFirst,
      });
      isFirst = false;
    }

    const snapResult: SnapResult = {
      title: productTitle,
      description,
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
