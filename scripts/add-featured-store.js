/**
 * Add Featured Store CLI Script
 *
 * Interactive CLI to add a new "Featured Store of the Week" to Supabase.
 * Extracts ASINs from Amazon affiliate links, fetches product details
 * from SerpAPI's Amazon Product API, and inserts everything into the
 * featured_stores / featured_store_products tables.
 *
 * Usage:
 *   node scripts/add-featured-store.js
 *
 * Environment variables (from .env or .env.local):
 *   SUPABASE_URL               - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   - Service role key (bypasses RLS)
 *   SERPAPI_KEY                 - SerpAPI API key
 *
 * Falls back to EXPO_PUBLIC_SUPABASE_URL if SUPABASE_URL is not set.
 */

const readline = require('readline');
const path = require('path');

// ---------------------------------------------------------------------------
// Load environment variables from .env / .env.local
// ---------------------------------------------------------------------------
function loadEnv() {
  const fs = require('fs');
  const envFiles = ['.env.local', '.env'];

  for (const envFile of envFiles) {
    const envPath = path.resolve(__dirname, '..', envFile);
    if (!fs.existsSync(envPath)) continue;

    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.substring(0, eqIdx).trim();
      const value = trimmed.substring(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

loadEnv();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SERPAPI_KEY = process.env.SERPAPI_KEY;

if (!SUPABASE_URL) {
  console.error(
    'ERROR: SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) is not set in your environment.'
  );
  process.exit(1);
}
if (!SUPABASE_SERVICE_KEY) {
  console.error(
    'ERROR: SUPABASE_SERVICE_ROLE_KEY is not set in your environment.\n' +
      'You need the service role key to write to the featured_stores table (bypasses RLS).'
  );
  process.exit(1);
}
if (!SERPAPI_KEY) {
  console.error('ERROR: SERPAPI_KEY is not set in your environment.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Readline helper
// ---------------------------------------------------------------------------
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question, defaultValue) {
  return new Promise((resolve) => {
    const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

function askMultiline(question) {
  return new Promise((resolve) => {
    console.log(`${question} (paste one per line, empty line to finish):`);
    const lines = [];
    const lineHandler = (line) => {
      if (line.trim() === '') {
        rl.removeListener('line', lineHandler);
        resolve(lines);
      } else {
        lines.push(line.trim());
      }
    };
    rl.on('line', lineHandler);
  });
}

// ---------------------------------------------------------------------------
// Affiliate tag helper
// ---------------------------------------------------------------------------
const AFFILIATE_TAG = 'luminasoftwar-20';

/**
 * Ensure the affiliate tag is present on an Amazon URL.
 * If the URL already has a tag param it will be replaced.
 */
function ensureAffiliateTag(rawUrl) {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    url.searchParams.set('tag', AFFILIATE_TAG);
    return url.toString();
  } catch {
    // If it's not a valid URL, return as-is
    return rawUrl;
  }
}

// ---------------------------------------------------------------------------
// ASIN extractor
// ---------------------------------------------------------------------------
function extractAsin(url) {
  // Match /dp/ASIN or /gp/product/ASIN patterns
  const dpMatch = url.match(/\/dp\/([A-Z0-9]{10})/i);
  if (dpMatch) return dpMatch[1].toUpperCase();

  const gpMatch = url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
  if (gpMatch) return gpMatch[1].toUpperCase();

  // Match ?asin=ASIN query parameter
  const asinMatch = url.match(/[?&]asin=([A-Z0-9]{10})/i);
  if (asinMatch) return asinMatch[1].toUpperCase();

  return null;
}

// ---------------------------------------------------------------------------
// SerpAPI product fetcher
// ---------------------------------------------------------------------------
async function fetchProductDetails(asin) {
  const params = new URLSearchParams({
    engine: 'amazon_product',
    asin: asin,
    amazon_domain: 'amazon.com',
    api_key: SERPAPI_KEY,
    // Only fetch what we need for a smaller/faster response
    json_restrictor: 'product_results',
  });

  const url = `https://serpapi.com/search?${params.toString()}`;
  console.log(`  Fetching ASIN ${asin}...`);

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SerpAPI error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`SerpAPI error: ${data.error}`);
  }

  const product = data.product_results;
  if (!product) {
    throw new Error(`No product_results returned for ASIN ${asin}`);
  }

  // Pick the best image: first high-res thumbnail, or the main thumbnail
  const imageUrl =
    (product.thumbnails && product.thumbnails.length > 0
      ? product.thumbnails[0]
      : null) || product.thumbnail || null;

  return {
    title: product.title || 'Unknown Product',
    description: product.description || null,
    price: product.price || null,
    extractedPrice: product.extracted_price ?? null,
    oldPrice: product.old_price || null,
    extractedOldPrice: product.extracted_old_price ?? null,
    imageUrl,
    rating: product.rating ?? null,
    reviewCount: product.reviews ?? null,
  };
}

// ---------------------------------------------------------------------------
// Supabase REST helpers (using service role key, no SDK needed)
// ---------------------------------------------------------------------------
async function supabaseRequest(tablePath, method, body) {
  const url = `${SUPABASE_URL}/rest/v1/${tablePath}`;
  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: method === 'POST' ? 'return=representation' : 'return=minimal',
  };

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase ${method} ${tablePath} failed (${response.status}): ${errorText}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function insertStore(store) {
  const rows = await supabaseRequest('featured_stores', 'POST', store);
  return rows[0];
}

async function insertProducts(products) {
  return supabaseRequest('featured_store_products', 'POST', products);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('='.repeat(60));
  console.log('  Add Featured Store of the Week');
  console.log('='.repeat(60));
  console.log();

  // --- Gather store info ---------------------------------------------------
  const brandName = await ask('Brand name (e.g. "Creed")');
  if (!brandName) {
    console.error('Brand name is required.');
    process.exit(1);
  }

  const shoppingCategory = await ask('Shopping category (e.g. "Cologne", "Electronics")');
  if (!shoppingCategory) {
    console.error('Shopping category is required.');
    process.exit(1);
  }

  const brandLogoUrl = await ask('Brand logo URL (optional, press Enter to skip)');
  const gradientStart = await ask('Background gradient start color (hex)', '#8B7355');
  const gradientEnd = await ask('Background gradient end color (hex)', '#5C4A32');
  const backgroundImageUrl = await ask('Background image URL (optional, press Enter to skip)');
  const rawStoreUrl = await ask('Store page URL (optional, press Enter to skip)');

  const today = new Date();
  const defaultWeekStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const weekStart = await ask('Week start date (YYYY-MM-DD)', defaultWeekStart);

  console.log();

  // --- Gather product links ------------------------------------------------
  const links = await askMultiline('Amazon affiliate product links');

  if (links.length === 0) {
    console.error('At least one product link is required.');
    process.exit(1);
  }

  // Extract ASINs and keep original affiliate URLs
  const productInputs = [];
  for (const link of links) {
    const asin = extractAsin(link);
    if (!asin) {
      console.warn(`  WARNING: Could not extract ASIN from: ${link}`);
      console.warn('  Skipping this link.');
      continue;
    }
    productInputs.push({ asin, affiliateUrl: link });
  }

  if (productInputs.length === 0) {
    console.error('No valid ASINs found in the provided links.');
    process.exit(1);
  }

  console.log(`\nFound ${productInputs.length} valid product(s). Fetching details from SerpAPI...\n`);

  // --- Fetch product details from SerpAPI ----------------------------------
  const products = [];
  for (let i = 0; i < productInputs.length; i++) {
    const { asin, affiliateUrl } = productInputs[i];
    try {
      const details = await fetchProductDetails(asin);
      products.push({
        asin,
        affiliateUrl,
        sortOrder: i,
        ...details,
      });
      console.log(`  ✓ ${details.title} — ${details.price || 'price N/A'}`);
    } catch (err) {
      console.error(`  ✗ Failed to fetch ASIN ${asin}: ${err.message}`);
      // Still include with minimal data
      products.push({
        asin,
        affiliateUrl,
        sortOrder: i,
        title: `Product ${asin}`,
        description: null,
        price: null,
        extractedPrice: null,
        oldPrice: null,
        extractedOldPrice: null,
        imageUrl: null,
        rating: null,
        reviewCount: null,
      });
    }
  }

  // --- Confirm before writing ----------------------------------------------
  console.log('\n' + '='.repeat(60));
  console.log('  Summary');
  console.log('='.repeat(60));
  // Build store URL with affiliate tag
  const storeUrl = ensureAffiliateTag(rawStoreUrl);

  console.log(`  Brand:       ${brandName}`);
  console.log(`  Category:    ${shoppingCategory}`);
  console.log(`  Store URL:   ${storeUrl || '(none)'}`);
  console.log(`  Gradient:    ${gradientStart} → ${gradientEnd}`);
  console.log(`  Week Start:  ${weekStart}`);
  console.log(`  Products:    ${products.length}`);
  for (const p of products) {
    console.log(`    - [${p.asin}] ${p.title} (${p.price || 'N/A'})`);
  }
  console.log();

  const confirm = await ask('Insert into Supabase? (y/n)', 'y');
  if (confirm.toLowerCase() !== 'y') {
    console.log('Aborted.');
    rl.close();
    return;
  }

  // --- Write to Supabase ---------------------------------------------------
  console.log('\nInserting new featured store...');
  const storeRow = await insertStore({
    brand_name: brandName,
    brand_logo_url: brandLogoUrl || null,
    shopping_category: shoppingCategory,
    background_gradient_start: gradientStart,
    background_gradient_end: gradientEnd,
    background_image_url: backgroundImageUrl || null,
    store_url: storeUrl || null,
    is_active: true,
    week_start: weekStart,
  });

  const storeId = storeRow.id;
  console.log(`  Store created: ${storeId}`);

  console.log('Inserting products...');
  const productRows = products.map((p) => ({
    store_id: storeId,
    asin: p.asin,
    title: p.title,
    description: p.description,
    price: p.price,
    extracted_price: p.extractedPrice,
    old_price: p.oldPrice,
    extracted_old_price: p.extractedOldPrice,
    image_url: p.imageUrl,
    rating: p.rating,
    review_count: p.reviewCount,
    affiliate_url: p.affiliateUrl,
    sort_order: p.sortOrder,
  }));

  await insertProducts(productRows);
  console.log(`  ${productRows.length} product(s) inserted.`);

  console.log('\n' + '='.repeat(60));
  console.log('  Done! Featured store is now active.');
  console.log('='.repeat(60));

  rl.close();
}

main().catch((err) => {
  console.error('\nFatal error:', err.message);
  rl.close();
  process.exit(1);
});
