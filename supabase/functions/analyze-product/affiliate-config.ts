/**
 * Affiliate Tag Configuration
 *
 * This module manages affiliate tags for different retailers.
 * When a URL matches a configured domain, the appropriate affiliate
 * tag parameter will be appended to the URL.
 */

export interface AffiliateConfig {
  /** The query parameter name to use (e.g., "tag" for Amazon) */
  param: string;
  /** The affiliate tag value */
  tag: string;
}

/**
 * Map of domain patterns to their affiliate configurations.
 * Add new affiliate programs here as they are set up.
 */
export const AFFILIATE_TAGS: Record<string, AffiliateConfig> = {
  'amazon.com': { param: 'tag', tag: 'luminasoftwar-20' },
  // Future affiliate programs:
  // 'target.com': { param: 'affiliateId', tag: 'your-target-id' },
  // 'bestbuy.com': { param: 'ref', tag: 'your-bestbuy-id' },
  // 'walmart.com': { param: 'affiliates_id', tag: 'your-walmart-id' },
  // 'ebay.com': { param: 'campid', tag: 'your-ebay-campaign-id' },
};

/**
 * Appends the appropriate affiliate tag to a URL if the domain
 * matches a configured affiliate program.
 *
 * @param url - The product URL to modify
 * @returns The URL with affiliate tag appended (if applicable)
 */
export function appendAffiliateTag(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Find matching affiliate config
    for (const [domain, config] of Object.entries(AFFILIATE_TAGS)) {
      if (hostname.includes(domain)) {
        // Check if the tag is already present
        if (!urlObj.searchParams.has(config.param)) {
          urlObj.searchParams.set(config.param, config.tag);
        }
        return urlObj.toString();
      }
    }

    // No matching affiliate program, return original URL
    return url;
  } catch {
    // If URL parsing fails, return the original
    return url;
  }
}

/**
 * Extracts the retailer name from a URL for display purposes.
 *
 * @param url - The product URL
 * @returns A friendly retailer name
 */
export function getRetailerName(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    if (hostname.includes('amazon.com')) return 'Amazon';
    if (hostname.includes('target.com')) return 'Target';
    if (hostname.includes('bestbuy.com')) return 'Best Buy';
    if (hostname.includes('walmart.com')) return 'Walmart';
    if (hostname.includes('ebay.com')) return 'eBay';

    // Extract domain name for unknown retailers
    const parts = hostname.replace('www.', '').split('.');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } catch {
    return 'Unknown';
  }
}
