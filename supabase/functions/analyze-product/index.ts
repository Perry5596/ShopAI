import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { appendAffiliateTag, getRetailerName } from './affiliate-config.ts';

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// Affiliate domains to prioritize in web search
const AFFILIATE_DOMAINS = [
  'amazon.com',
  'target.com',
  'bestbuy.com',
  'walmart.com',
  'ebay.com',
];

// Response schema for structured output
interface ProductResult {
  productName: string;
  description: string;
  products: Array<{
    title: string;
    price: string;
    url: string;
    imageUrl?: string;
    rating?: number;
    reviewCount?: number;
  }>;
  recommendedIndex: number;
}

// SnapResult format expected by the frontend
interface SnapResult {
  title: string;
  description?: string;
  products: Array<{
    title: string;
    price: string;
    imageUrl?: string;
    affiliateUrl: string;
    source: string;
    isRecommended: boolean;
    rating?: number;
    reviewCount?: number;
  }>;
  recommendedIndex?: number;
}

serve(async (req) => {
  console.log('Function invoked, method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { imageUrl } = body;
    console.log('Received imageUrl:', imageUrl ? 'present' : 'missing');

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'imageUrl is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    console.log('API key present:', !!openaiApiKey, 'length:', openaiApiKey?.length);
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    console.log('Making request to OpenAI...');

    // Build the prompt for product identification and search
    const systemPrompt = `You are a product identification and shopping assistant. Your task is to:
1. Analyze the image to identify the product
2. Search for this EXACT product or the closest match on major retail websites
3. Return accurate product listings with VERIFIED, REAL product URLs

CRITICAL RULES - YOU MUST FOLLOW THESE:

1. ONE PRODUCT PER RETAILER: Return ONLY ONE product from each retailer. Never return multiple products from the same website (e.g., not 2 Amazon links, not 2 Target links).

2. AMAZON IS REQUIRED: You MUST always include an Amazon.com result as the FIRST product. If you cannot find the exact product on Amazon, find the closest similar product available on Amazon.

3. VERIFIED URLS ONLY: Only include URLs that you have VERIFIED exist and lead to real, purchasable product pages. Do NOT make up or guess URLs. The URL must be a direct link to a product page, not a search results page.

4. URL FORMAT: URLs must be complete product page URLs (e.g., https://www.amazon.com/dp/XXXXXXXXXX or https://www.amazon.com/product-name/dp/XXXXXXXXXX). Do NOT include search URLs or category URLs.

5. PRICE ACCURACY: Only include prices you found on the actual product pages. Format as "$XX.XX".

6. DIFFERENT RETAILERS: After Amazon, try to include results from different retailers: Target, Best Buy, Walmart, eBay. Maximum 5 products total (1 per retailer).

Return your response as a JSON object with this exact structure:
{
  "productName": "The general name/type of the product identified in the image",
  "description": "A brief description of what was identified",
  "products": [
    {
      "title": "Exact product name from Amazon",
      "price": "$XX.XX",
      "url": "https://www.amazon.com/dp/XXXXXXXXXX",
      "rating": 4.5,
      "reviewCount": 1234
    },
    {
      "title": "Product name from Target",
      "price": "$XX.XX",
      "url": "https://www.target.com/p/product-name/-/A-XXXXXXXX"
    }
  ],
  "recommendedIndex": 0
}

Set recommendedIndex to the index of the best value product. Amazon should be index 0.`;

    // Call OpenAI Responses API with gpt-5-nano
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-nano',
        reasoning: { effort: 'low' },
        tools: [
          {
            type: 'web_search',
            filters: {
              allowed_domains: AFFILIATE_DOMAINS,
            },
          },
        ],
        tool_choice: 'auto',
        input: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: 'Identify this product and find where I can buy it online. Search Amazon first, then other retailers. Only include verified product page URLs that you confirmed exist. One product per retailer maximum.',
              },
              {
                type: 'input_image',
                image_url: imageUrl,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', response.status, errorData);
      // Return the actual error details for debugging
      throw new Error(`OpenAI API error (${response.status}): ${errorData}`);
    }

    const data = await response.json();

    // Extract the text response from the API output
    let outputText = '';
    if (data.output) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            if (content.type === 'output_text') {
              outputText = content.text;
              break;
            }
          }
        }
      }
    }

    // Parse the JSON response from the model
    let productResult: ProductResult;
    try {
      // Try to extract JSON from the response (it might be wrapped in markdown code blocks)
      const jsonMatch = outputText.match(/```json\s*([\s\S]*?)\s*```/) ||
        outputText.match(/```\s*([\s\S]*?)\s*```/) ||
        [null, outputText];

      const jsonStr = jsonMatch[1] || outputText;
      productResult = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', outputText);
      // Return a fallback response
      return new Response(
        JSON.stringify({
          title: 'Product Identified',
          description: 'Unable to find product listings. Please try again.',
          products: [],
          recommendedIndex: undefined,
        } as SnapResult),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Deduplicate products by domain (keep first occurrence of each retailer)
    const seenDomains = new Set<string>();
    const deduplicatedProducts = productResult.products.filter((product) => {
      try {
        const url = new URL(product.url);
        const domain = url.hostname.toLowerCase().replace('www.', '');
        // Extract base domain (e.g., "amazon.com" from "smile.amazon.com")
        const baseDomain = domain.split('.').slice(-2).join('.');
        
        if (seenDomains.has(baseDomain)) {
          console.log('Filtering duplicate domain:', baseDomain);
          return false;
        }
        seenDomains.add(baseDomain);
        return true;
      } catch {
        // If URL parsing fails, keep the product but log it
        console.log('Invalid URL in product:', product.url);
        return true;
      }
    });

    // Transform to SnapResult format and add affiliate tags
    const snapResult: SnapResult = {
      title: productResult.productName,
      description: productResult.description,
      products: deduplicatedProducts.map((product, index) => ({
        title: product.title,
        price: product.price,
        imageUrl: product.imageUrl,
        affiliateUrl: appendAffiliateTag(product.url),
        source: getRetailerName(product.url),
        isRecommended: index === 0, // First product (should be Amazon) is recommended
        rating: product.rating,
        reviewCount: product.reviewCount,
      })),
      recommendedIndex: 0, // Amazon is always first and recommended
    };

    return new Response(JSON.stringify(snapResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
