# Supabase Edge Functions

## analyze-product

This function uses SerpAPI Google Lens to identify products from images and find matching products from supported retailers.

### Supported Retailers

- Amazon
- eBay
- Target
- Best Buy
- Walmart

### Environment Variables

Set the following secret using the Supabase CLI:

```bash
supabase secrets set SERPAPI_KEY=your_serpapi_key_here
```

Or via the Supabase Dashboard:
1. Go to your project's Edge Functions settings
2. Add a new secret named `SERPAPI_KEY`
3. Paste your SerpAPI key as the value

### Getting a SerpAPI Key

1. Sign up at [SerpAPI](https://serpapi.com/)
2. Navigate to [Manage API Key](https://serpapi.com/manage-api-key)
3. Copy your API key

### API Usage

**Request:**
```json
POST /functions/v1/analyze-product
{
  "imageUrl": "https://your-supabase-project.supabase.co/storage/v1/object/public/shop-images/..."
}
```

**Response:**
```json
{
  "title": "Product Name",
  "description": "Found 3 products from verified retailers",
  "products": [
    {
      "title": "Product Title from Retailer",
      "price": "$99.99",
      "imageUrl": "https://...",
      "affiliateUrl": "https://amazon.com/...?tag=your-affiliate-tag",
      "source": "Amazon",
      "isRecommended": true,
      "rating": 4.5,
      "reviewCount": 1234
    }
  ]
}
```
