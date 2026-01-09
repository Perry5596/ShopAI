import type { SnapResult, ProductLink } from '@/types';

/**
 * Mock AI service that simulates image analysis.
 * Returns dummy data that matches the SnapResult schema.
 *
 * When integrating with a real AI service:
 * 1. Replace the implementation of analyzeImage()
 * 2. Keep the same function signature and return type
 * 3. The rest of the app will work without changes
 */

// Simulated delay to mimic AI processing time
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mock product data pools for variety
const MOCK_PRODUCTS: Array<Omit<ProductLink, 'id' | 'shopId'>> = [
  {
    title: 'Nike Air Max 90',
    price: '$129.99',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200',
    affiliateUrl: 'https://nike.com/air-max-90',
    source: 'Nike',
    isRecommended: false,
    rating: 4.8,
    reviewCount: 2341,
  },
  {
    title: 'Nike Air Max 90 Essential',
    price: '$119.99',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200',
    affiliateUrl: 'https://amazon.com/nike-air-max',
    source: 'Amazon',
    isRecommended: false,
    rating: 4.5,
    reviewCount: 892,
  },
  {
    title: 'Apple Watch Series 9',
    price: '$399.00',
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200',
    affiliateUrl: 'https://apple.com/watch',
    source: 'Apple',
    isRecommended: false,
    rating: 4.9,
    reviewCount: 5621,
  },
  {
    title: 'Apple Watch Series 9 GPS',
    price: '$379.00',
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200',
    affiliateUrl: 'https://amazon.com/apple-watch',
    source: 'Amazon',
    isRecommended: false,
    rating: 4.7,
    reviewCount: 1234,
  },
  {
    title: 'Vintage Leather Backpack',
    price: '$89.99',
    imageUrl: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=200',
    affiliateUrl: 'https://amazon.com/leather-backpack',
    source: 'Amazon',
    isRecommended: false,
    rating: 4.4,
    reviewCount: 1205,
  },
  {
    title: 'Premium Leather Bag',
    price: '$109.99',
    imageUrl: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=200',
    affiliateUrl: 'https://target.com/leather-bag',
    source: 'Target',
    isRecommended: false,
    rating: 4.2,
    reviewCount: 456,
  },
  {
    title: 'Sony WH-1000XM5',
    price: '$349.99',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200',
    affiliateUrl: 'https://sony.com/headphones',
    source: 'Sony',
    isRecommended: false,
    rating: 4.9,
    reviewCount: 8923,
  },
  {
    title: 'Sony WH-1000XM5 Wireless',
    price: '$329.99',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200',
    affiliateUrl: 'https://amazon.com/sony-headphones',
    source: 'Amazon',
    isRecommended: false,
    rating: 4.8,
    reviewCount: 3456,
  },
];

const MOCK_TITLES = [
  'Nike Air Max 90',
  'Apple Watch Series 9',
  'Vintage Leather Backpack',
  'Sony WH-1000XM5 Headphones',
  'Classic Sneakers',
  'Smart Watch',
  'Premium Bag',
  'Wireless Headphones',
];

const MOCK_DESCRIPTIONS = [
  'Classic sneakers spotted',
  'Smart wearable device detected',
  'Premium leather accessory found',
  'High-quality audio equipment identified',
  'Stylish footwear match',
  'Tech gadget recognized',
  'Fashion accessory detected',
  'Popular product found',
];

/**
 * Analyzes an image and returns product recommendations.
 *
 * @param imageUrl - The URL of the image to analyze
 * @returns SnapResult with title, description, products, and recommended index
 *
 * @example
 * const result = await analyzeImage('https://example.com/photo.jpg');
 * // result.title = 'Nike Air Max 90'
 * // result.products = [{ title: 'Nike Air Max 90', price: '$129.99', ... }, ...]
 * // result.recommendedIndex = 0
 */
export async function analyzeImage(imageUrl: string): Promise<SnapResult> {
  // Simulate AI processing delay (2-4 seconds)
  const processingTime = 2000 + Math.random() * 2000;
  await delay(processingTime);

  // Randomly select 2-4 products
  const numProducts = 2 + Math.floor(Math.random() * 3);
  const shuffled = [...MOCK_PRODUCTS].sort(() => Math.random() - 0.5);
  const selectedProducts = shuffled.slice(0, numProducts);

  // Pick a random title and description
  const titleIndex = Math.floor(Math.random() * MOCK_TITLES.length);
  const title = MOCK_TITLES[titleIndex];
  const description = MOCK_DESCRIPTIONS[titleIndex % MOCK_DESCRIPTIONS.length];

  // Randomly select which product to recommend
  const recommendedIndex = Math.floor(Math.random() * selectedProducts.length);

  return {
    title,
    description,
    products: selectedProducts,
    recommendedIndex,
  };
}

/**
 * Simulates a failed AI analysis (for testing error states).
 * Use this to test how the app handles processing failures.
 */
export async function analyzeImageWithError(imageUrl: string): Promise<SnapResult> {
  await delay(1500);
  throw new Error('AI service temporarily unavailable');
}
