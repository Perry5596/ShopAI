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
 * Fetch and extract price from a product page URL.
 * Tries multiple methods: Open Graph tags, JSON-LD, retailer-specific HTML parsing.
 */
async function fetchProductPrice(url: string, timeoutMs = 2000): Promise<string | undefined> {
  try {
    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return undefined;
    }

    const html = await response.text();
    const urlLower = url.toLowerCase();

    // Method 1: Open Graph tags
    const ogPriceMatch = html.match(/<meta\s+property=["']og:price:amount["']\s+content=["']([^"']+)["']/i);
    if (ogPriceMatch) {
      const price = parseFloat(ogPriceMatch[1]);
      if (!isNaN(price) && price > 0) {
        return `$${price.toFixed(2)}`;
      }
    }

    // Method 2: JSON-LD structured data
    const jsonLdMatches = html.match(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatches) {
      for (const match of jsonLdMatches) {
        try {
          const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '').trim();
          const data = JSON.parse(jsonContent);
          
          // Check for Product schema
          if (data['@type'] === 'Product' || (Array.isArray(data['@type']) && data['@type'].includes('Product'))) {
            if (data.offers) {
              const offers = Array.isArray(data.offers) ? data.offers : [data.offers];
              const validPrices: number[] = [];
              
              for (const offer of offers) {
                // Skip used/refurbished offers - prioritize new/current price
                const itemCondition = (offer.itemCondition || '').toLowerCase();
                if (itemCondition.includes('used') || 
                    itemCondition.includes('refurbished') ||
                    itemCondition.includes('collectible')) {
                  continue;
                }
                
                if (offer.price) {
                  const price = typeof offer.price === 'string' 
                    ? parseFloat(offer.price.replace(/[^0-9.]/g, ''))
                    : parseFloat(offer.price);
                  if (!isNaN(price) && price > 0) {
                    validPrices.push(price);
                  }
                }
              }
              
              // Return the lowest price (usually the current/new price)
              if (validPrices.length > 0) {
                const minPrice = Math.min(...validPrices);
                return `$${minPrice.toFixed(2)}`;
              }
            }
            if (data.price) {
              const price = typeof data.price === 'string'
                ? parseFloat(data.price.replace(/[^0-9.]/g, ''))
                : parseFloat(data.price);
              if (!isNaN(price) && price > 0) {
                return `$${price.toFixed(2)}`;
              }
            }
          }
        } catch {
          // Skip invalid JSON
          continue;
        }
      }
    }

    // Method 3: Retailer-specific HTML parsing
    if (urlLower.includes('amazon.com')) {
      // Amazon: Prioritize current price, avoid list/used prices
      // Pattern 1: priceblock_ourprice or priceblock_dealprice (current price)
      const currentPriceMatch = html.match(/<span[^>]*id=["']priceblock_(?:ourprice|dealprice)["'][^>]*>[\s$]*([\d,.]+)/i);
      if (currentPriceMatch) {
        const price = parseFloat(currentPriceMatch[1].replace(/[^0-9.]/g, ''));
        if (!isNaN(price) && price > 0) {
          return `$${price.toFixed(2)}`;
        }
      }

      // Pattern 2: a-price-whole (current price format) - but exclude if it's in a "used" or "list price" context
      const priceWholeMatches = html.matchAll(/<span[^>]*class=["'][^"']*a-price-whole["'][^>]*>([\d,]+)<\/span>/gi);
      for (const match of priceWholeMatches) {
        // Check context - make sure it's not a list price or used price
        const contextStart = Math.max(0, match.index! - 200);
        const contextEnd = Math.min(html.length, match.index! + match[0].length + 200);
        const context = html.substring(contextStart, contextEnd).toLowerCase();
        
        // Skip if it's a list price, used price, or "from" price
        if (context.includes('list price') || 
            context.includes('used') || 
            context.includes('from') ||
            context.includes('priceblock_saleprice')) {
          continue;
        }
        
        // This looks like the current price
        const price = parseFloat(match[1].replace(/[^0-9.]/g, ''));
        if (!isNaN(price) && price > 0) {
          // Also check for price fraction (cents)
          const fractionMatch = html.substring(match.index!, match.index! + 100).match(/<span[^>]*class=["'][^"']*a-price-fraction["'][^>]*>(\d+)<\/span>/i);
          if (fractionMatch) {
            return `$${price.toFixed(2)}`;
          } else {
            return `$${price.toFixed(2)}`;
          }
        }
      }

      // Pattern 3: Generic a-price pattern (last resort, but check context)
      const genericPriceMatches = html.matchAll(/<span[^>]*class=["'][^"']*a-price[^"']*["'][^>]*>[\s$]*\$?([\d,.]+)/gi);
      for (const match of genericPriceMatches) {
        const contextStart = Math.max(0, match.index! - 200);
        const contextEnd = Math.min(html.length, match.index! + match[0].length + 200);
        const context = html.substring(contextStart, contextEnd).toLowerCase();
        
        // Skip list/used prices
        if (!context.includes('list price') && 
            !context.includes('used') && 
            !context.includes('priceblock_saleprice')) {
          const price = parseFloat(match[1].replace(/[^0-9.]/g, ''));
          if (!isNaN(price) && price > 0 && price < 10000) { // Sanity check
            return `$${price.toFixed(2)}`;
          }
        }
      }
    } else if (urlLower.includes('ebay.com')) {
      // eBay: Look for price
      const ebayPatterns = [
        /<span[^>]*class=["'][^"']*notranslate[^"']*["'][^>]*>[\s$]*([\d,.]+)/i,
        /<span[^>]*itemprop=["']price["'][^>]*content=["']([\d.]+)["']/i,
      ];
      
      for (const pattern of ebayPatterns) {
        const match = html.match(pattern);
        if (match) {
          const price = parseFloat(match[1].replace(/[^0-9.]/g, ''));
          if (!isNaN(price) && price > 0) {
            return `$${price.toFixed(2)}`;
          }
        }
      }
    } else if (urlLower.includes('target.com')) {
      // Target: Look for price
      const targetPatterns = [
        /<span[^>]*data-test=["']product-price[^"']*["'][^>]*>[\s$]*([\d,.]+)/i,
        /<span[^>]*class=["'][^"']*h-text-bold[^"']*["'][^>]*>[\s$]*\$?([\d,.]+)/i,
      ];
      
      for (const pattern of targetPatterns) {
        const match = html.match(pattern);
        if (match) {
          const price = parseFloat(match[1].replace(/[^0-9.]/g, ''));
          if (!isNaN(price) && price > 0) {
            return `$${price.toFixed(2)}`;
          }
        }
      }
    } else if (urlLower.includes('bestbuy.com')) {
      // Best Buy: Look for price
      const bestbuyPatterns = [
        /<div[^>]*class=["'][^"']*priceView-customer-price[^"']*["'][^>]*>[\s\S]*?<span[^>]*>[\s$]*\$?([\d,.]+)/i,
        /<span[^>]*class=["'][^"']*price[^"']*["'][^>]*>[\s$]*\$?([\d,.]+)/i,
      ];
      
      for (const pattern of bestbuyPatterns) {
        const match = html.match(pattern);
        if (match) {
          const price = parseFloat(match[1].replace(/[^0-9.]/g, ''));
          if (!isNaN(price) && price > 0) {
            return `$${price.toFixed(2)}`;
          }
        }
      }
    } else if (urlLower.includes('walmart.com')) {
      // Walmart: Look for price in various formats
      // Pattern 1: itemprop price (structured data)
      const itempropMatch = html.match(/<span[^>]*itemprop=["']price["'][^>]*content=["']([\d.]+)["']/i);
      if (itempropMatch) {
        const price = parseFloat(itempropMatch[1]);
        if (!isNaN(price) && price > 0) {
          return `$${price.toFixed(2)}`;
        }
      }

      // Pattern 2: priceDisplay class (current price display)
      const priceDisplayMatch = html.match(/<span[^>]*class=["'][^"']*priceDisplay[^"']*["'][^>]*>[\s$]*\$?([\d,.]+)/i);
      if (priceDisplayMatch) {
        const price = parseFloat(priceDisplayMatch[1].replace(/[^0-9.]/g, ''));
        if (!isNaN(price) && price > 0) {
          return `$${price.toFixed(2)}`;
        }
      }

      // Pattern 3: price-characteristic (Walmart's price format)
      const priceCharMatch = html.match(/<span[^>]*class=["'][^"']*price-characteristic[^"']*["'][^>]*content=["']([\d.]+)["']/i);
      if (priceCharMatch) {
        const price = parseFloat(priceCharMatch[1]);
        if (!isNaN(price) && price > 0) {
          return `$${price.toFixed(2)}`;
        }
      }

      // Pattern 4: prod-PriceHero (hero price display)
      const heroPriceMatch = html.match(/<span[^>]*class=["'][^"']*prod-PriceHero[^"']*["'][^>]*>[\s$]*\$?([\d,.]+)/i);
      if (heroPriceMatch) {
        const price = parseFloat(heroPriceMatch[1].replace(/[^0-9.]/g, ''));
        if (!isNaN(price) && price > 0) {
          return `$${price.toFixed(2)}`;
        }
      }

      // Pattern 5: price-current or price-current-wrapper
      const currentPriceMatch = html.match(/<span[^>]*class=["'][^"']*price-current[^"']*["'][^>]*>[\s$]*\$?([\d,.]+)/i);
      if (currentPriceMatch) {
        const price = parseFloat(currentPriceMatch[1].replace(/[^0-9.]/g, ''));
        if (!isNaN(price) && price > 0) {
          return `$${price.toFixed(2)}`;
        }
      }

      // Pattern 6: data-automation-id="product-price" (Walmart's automation attributes)
      const automationMatch = html.match(/<span[^>]*data-automation-id=["']product-price["'][^>]*>[\s$]*\$?([\d,.]+)/i);
      if (automationMatch) {
        const price = parseFloat(automationMatch[1].replace(/[^0-9.]/g, ''));
        if (!isNaN(price) && price > 0) {
          return `$${price.toFixed(2)}`;
        }
      }

      // Pattern 7: Generic price class (last resort, but check context)
      const genericPriceMatches = html.matchAll(/<span[^>]*class=["'][^"']*price[^"']*["'][^>]*>[\s$]*\$?([\d,.]+)/gi);
      for (const match of genericPriceMatches) {
        const contextStart = Math.max(0, match.index! - 200);
        const contextEnd = Math.min(html.length, match.index! + match[0].length + 200);
        const context = html.substring(contextStart, contextEnd).toLowerCase();
        
        // Skip if it's a list price, was price, or other non-current price
        if (!context.includes('was') && 
            !context.includes('list price') && 
            !context.includes('save') &&
            !context.includes('price-marker')) {
          const price = parseFloat(match[1].replace(/[^0-9.]/g, ''));
          if (!isNaN(price) && price > 0 && price < 100000) {
            return `$${price.toFixed(2)}`;
          }
        }
      }
    }

    // Method 4: Generic price pattern as last resort
    const genericPriceMatch = html.match(/\$[\d,]+\.?\d{0,2}/);
    if (genericPriceMatch) {
      const price = parseFloat(genericPriceMatch[0].replace(/[$,]/g, ''));
      if (!isNaN(price) && price > 0 && price < 1000000) { // Sanity check
        return genericPriceMatch[0];
      }
    }

    return undefined;
  } catch (error) {
    // Silently fail - we'll fall back to snippet price
    return undefined;
  }
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
 * Check if a URL looks like a search results page rather than a direct product page.
 */
function isSearchResultsPage(url: string): boolean {
  const searchPatterns = [
    '/s?',        // Amazon search
    '/s/',        // Amazon search
    '/sch/',      // eBay search
    '/search',    // Generic search
    '/browse/',   // Category browse
    'k=',         // Amazon keyword param
    'query=',     // Generic query param
    '_nkw=',      // eBay keyword param
  ];
  
  const urlLower = url.toLowerCase();
  return searchPatterns.some(pattern => urlLower.includes(pattern));
}

/**
 * Step 3: Select the best result for each retailer domain.
 * Prioritizes direct product links over search result pages.
 */
function selectBestPerRetailer(results: CSEResult[]): Map<string, CSEResult> {
  const productLinks = new Map<string, CSEResult>();  // Direct product pages
  const searchLinks = new Map<string, CSEResult>();   // Search/browse pages (fallback)

  for (const result of results) {
    try {
      const hostname = new URL(result.link).hostname.replace('www.', '').toLowerCase();
      const retailer = RETAILER_DOMAINS.find((r) => hostname.includes(r));

      if (!retailer) continue;

      const isSearch = isSearchResultsPage(result.link);

      if (isSearch) {
        // Store as fallback if we don't have one yet
        if (!searchLinks.has(retailer)) {
          searchLinks.set(retailer, result);
        }
      } else {
        // Direct product link - prioritize these
        if (!productLinks.has(retailer)) {
          productLinks.set(retailer, result);
        }
      }
    } catch {
      // Skip invalid URLs
      continue;
    }
  }

  // Merge: use product links first, fill gaps with search links
  const selected = new Map<string, CSEResult>(productLinks);
  for (const [retailer, result] of searchLinks) {
    if (!selected.has(retailer)) {
      selected.set(retailer, result);
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

    // Step 4: Build initial product list with snippet prices (fast)
    const productTitle = productInfo.brand && productInfo.name
      ? `${productInfo.brand} ${productInfo.name}`
      : productInfo.name || productInfo.searchQuery;

    const description = [productInfo.color, productInfo.model]
      .filter(Boolean)
      .join(' - ') || undefined;

    const products: Array<{
      title: string;
      price?: string;
      affiliateUrl: string;
      source: string;
      isRecommended: boolean;
      url: string; // Store original URL for price fetching
    }> = [];
    let isFirst = true;

    for (const [, result] of selectedProducts) {
      const snippetPrice = extractPrice(result);
      products.push({
        title: result.title,
        price: snippetPrice, // Fallback price from snippet
        affiliateUrl: appendAffiliateTag(result.link),
        source: getRetailerName(result.link),
        isRecommended: isFirst,
        url: result.link, // Store for parallel fetching
      });
      isFirst = false;
    }

    // Step 5: Fetch prices in parallel (with timeout per request)
    // Skip search result pages - they won't have product prices
    const pricePromises = products.map(async (product) => {
      // Skip fetching for search result pages
      if (isSearchResultsPage(product.url)) {
        return product.price; // Keep snippet price for search pages
      }
      
      // Fetch price from product page
      const fetchedPrice = await fetchProductPrice(product.url, 2000);
      return fetchedPrice || product.price; // Use fetched price if available, otherwise keep snippet price
    });

    // Wait for all price fetches in parallel (max 2 seconds total)
    const fetchedPrices = await Promise.all(pricePromises);

    // Update products with fetched prices
    const finalProducts: SnapResult['products'] = products.map((product, index) => ({
      title: product.title,
      price: fetchedPrices[index],
      affiliateUrl: product.affiliateUrl,
      source: product.source,
      isRecommended: product.isRecommended,
    }));

    const snapResult: SnapResult = {
      title: productTitle,
      description,
      products: finalProducts,
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
