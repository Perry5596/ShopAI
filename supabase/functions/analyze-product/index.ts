import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { appendAffiliateTag, getRetailerName } from './affiliate-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AFFILIATE_DOMAINS = ['amazon.com', 'target.com', 'bestbuy.com', 'walmart.com', 'ebay.com'];

interface ProductResult {
  productName: string;
  description: string;
  products: Array<{ title: string; price: string; url: string; rating?: number; reviewCount?: number }>;
  recommendedIndex: number;
}

interface SnapResult {
  title: string;
  description?: string;
  products: Array<{ title: string; price: string; imageUrl?: string; affiliateUrl: string; source: string; isRecommended: boolean; rating?: number; reviewCount?: number }>;
  recommendedIndex?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: 'imageUrl is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) throw new Error('OPENAI_API_KEY is not configured');

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        reasoning: { effort: 'low' },
        tools: [{ type: 'web_search', filters: { allowed_domains: AFFILIATE_DOMAINS } }],
        tool_choice: 'required',
        input: [
          { role: 'system', content: 'Identify the product. Search online. Return JSON: {"productName":"name","description":"desc","products":[{"title":"t","price":"$X","url":"url"}],"recommendedIndex":0}. One product per store. Real URLs only.' },
          { role: 'user', content: [
            { type: 'input_text', text: 'What product is this? Find it online.' },
            { type: 'input_image', image_url: imageUrl }
          ]}
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorData}`);
    }

    const data = await response.json();
    let outputText = '';
    for (const item of data.output || []) {
      if (item.type === 'message' && item.content) {
        for (const content of item.content) {
          if (content.type === 'output_text') { outputText = content.text; break; }
        }
      }
    }

    let productResult: ProductResult;
    try {
      let jsonStr = outputText;
      const match = outputText.match(/```json\s*([\s\S]*?)\s*```/) || outputText.match(/```\s*([\s\S]*?)\s*```/) || outputText.match(/\{[\s\S]*"productName"[\s\S]*\}/);
      if (match) jsonStr = match[1] || match[0];
      productResult = JSON.parse(jsonStr.trim());
    } catch {
      return new Response(JSON.stringify({ title: 'Product', description: 'Unable to find listings.', products: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const seenDomains = new Set<string>();
    const validProducts = productResult.products.filter((p) => {
      if (/XXXX|xxxx|\.\.\./.test(p.url)) return false;
      try {
        const domain = new URL(p.url).hostname.replace('www.', '').split('.').slice(-2).join('.');
        if (seenDomains.has(domain)) return false;
        seenDomains.add(domain);
        return true;
      } catch { return false; }
    });

    const snapResult: SnapResult = {
      title: productResult.productName,
      description: productResult.description,
      products: validProducts.map((p, i) => ({
        title: p.title,
        price: p.price,
        affiliateUrl: appendAffiliateTag(p.url),
        source: getRetailerName(p.url),
        isRecommended: i === 0,
        rating: p.rating,
        reviewCount: p.reviewCount,
      })),
      recommendedIndex: 0,
    };

    return new Response(JSON.stringify(snapResult), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
