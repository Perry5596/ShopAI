/**
 * Centralized Ads Analytics Layer
 *
 * Wraps Meta (Facebook) AppEventsLogger and TikTok Business SDK
 * so every tracked event fires to both ad platforms simultaneously.
 * All calls are fire-and-forget with error handling so SDK failures
 * never block the UI or crash the app.
 *
 * Native SDKs are loaded dynamically so the app doesn't crash in Expo Go
 * (which lacks native modules). In development/production builds the SDKs
 * load normally.
 */

import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Dynamic SDK loading – gracefully degrade when native modules are missing
// (e.g. running in Expo Go instead of a development build)
// ---------------------------------------------------------------------------

let MetaSettings: { initializeSDK: () => void } | null = null;
let MetaAppEventsLogger: { logEvent: (event: string, params?: Record<string, string>) => void } | null = null;
let TiktokAdsEvents: any = null;
let TikTokStandardEvents: any = null;
let TikTokIdentifyFn: ((params: Record<string, string>) => Promise<void>) | null = null;
let TikTokWaitForConfigFn: ((timeout: number) => Promise<boolean>) | null = null;
let requestTrackingPermissionsAsyncFn: (() => Promise<{ status: string }>) | null = null;

try {
  const fbsdk = require('react-native-fbsdk-next');
  MetaSettings = fbsdk.Settings;
  MetaAppEventsLogger = fbsdk.AppEventsLogger;
} catch {
  console.warn('[AdsAnalytics] react-native-fbsdk-next not available (Expo Go?)');
}

try {
  const tiktok = require('expo-tiktok-ads-events');
  TiktokAdsEvents = tiktok.default;
  TikTokStandardEvents = tiktok.TikTokStandardEvents;
  TikTokIdentifyFn = tiktok.TikTokIdentify;
  TikTokWaitForConfigFn = tiktok.TikTokWaitForConfig;
} catch {
  console.warn('[AdsAnalytics] expo-tiktok-ads-events not available (Expo Go?)');
}

try {
  const tracking = require('expo-tracking-transparency');
  requestTrackingPermissionsAsyncFn = tracking.requestTrackingPermissionsAsync;
} catch {
  console.warn('[AdsAnalytics] expo-tracking-transparency not available (Expo Go?)');
}

// ---------------------------------------------------------------------------
// Credentials – replace with real values from Meta & TikTok Ads Manager
// ---------------------------------------------------------------------------
const TIKTOK_ACCESS_TOKEN = 'TTzXtZkUO4xFZSja4M9TE4lWOlnUXTzX'; // This is probably wrong, but it is being tested.
const TIKTOK_APP_ID = '6757626447';
const TIKTOK_TIKTOK_APP_ID = '7598962227563331592';

// Meta credentials are configured in app.json via the react-native-fbsdk-next
// config plugin (appID, clientToken). No JS-side constants needed for Meta.

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------
let _initialized = false;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Request ATT permission (iOS 14+) then initialise both the Meta and TikTok
 * SDKs.  Call this once at app startup (e.g. in the root layout useEffect).
 */
export async function initializeAdsSDKs(): Promise<void> {
  if (_initialized) return;

  try {
    // 1. Request App Tracking Transparency permission (iOS only)
    if (Platform.OS === 'ios' && requestTrackingPermissionsAsyncFn) {
      try {
        const { status } = await requestTrackingPermissionsAsyncFn();
        console.log('[AdsAnalytics] ATT permission status:', status);
      } catch (attError) {
        console.warn('[AdsAnalytics] ATT request failed:', attError);
      }
    }

    // 2. Initialise Meta SDK
    if (MetaSettings) {
      try {
        MetaSettings.initializeSDK();
        console.log('[AdsAnalytics] Meta SDK initialised');
      } catch (metaError) {
        console.warn('[AdsAnalytics] Meta SDK init failed:', metaError);
      }
    }

    // 3. Initialise TikTok SDK
    if (TiktokAdsEvents) {
      try {
        const result = await TiktokAdsEvents.initializeSdk(
          TIKTOK_ACCESS_TOKEN,
          TIKTOK_APP_ID,
          TIKTOK_TIKTOK_APP_ID,
          __DEV__, // debug mode in development
        );
        console.log('[AdsAnalytics] TikTok SDK init result:', result);

        // Wait for TikTok config (up to 10 s)
        if (TikTokWaitForConfigFn) {
          const configReady = await TikTokWaitForConfigFn(10_000);
          if (!configReady) {
            console.warn('[AdsAnalytics] TikTok config not loaded within timeout');
          }
        }
      } catch (ttError) {
        console.warn('[AdsAnalytics] TikTok SDK init failed:', ttError);
      }
    }

    _initialized = true;
    console.log('[AdsAnalytics] SDKs initialised');
  } catch (error) {
    console.error('[AdsAnalytics] Unexpected init error:', error);
  }
}

// ---------------------------------------------------------------------------
// User Identification
// ---------------------------------------------------------------------------

/**
 * Identify the current user so TikTok can attribute events.
 * Meta associates users automatically through its SDK.
 */
export async function identifyUser(
  userId: string,
  email?: string,
  name?: string,
): Promise<void> {
  if (!TikTokIdentifyFn) return;

  try {
    await TikTokIdentifyFn({
      externalId: userId,
      ...(email && { email }),
      ...(name && { externalUserName: name }),
    });
    console.log('[AdsAnalytics] TikTok user identified:', userId);
  } catch (error) {
    console.warn('[AdsAnalytics] TikTok identify failed:', error);
  }
}

// ---------------------------------------------------------------------------
// Event Tracking
// ---------------------------------------------------------------------------

/**
 * Track a completed sign-up / registration.
 */
export function trackSignUp(method: 'google' | 'apple' | 'guest'): void {
  // Meta – standard "Complete Registration" event
  if (MetaAppEventsLogger) {
    try {
      MetaAppEventsLogger.logEvent('fb_mobile_complete_registration', {
        fb_registration_method: method,
      });
      console.log('[AdsAnalytics] Meta: registration tracked –', method);
    } catch (error) {
      console.warn('[AdsAnalytics] Meta registration event failed:', error);
    }
  }

  // TikTok – standard registration event
  if (TiktokAdsEvents && TikTokStandardEvents) {
    try {
      TiktokAdsEvents.trackTTEvent(TikTokStandardEvents.registration, [
        { key: 'method', value: method },
      ]);
      console.log('[AdsAnalytics] TikTok: registration tracked –', method);
    } catch (error) {
      console.warn('[AdsAnalytics] TikTok registration event failed:', error);
    }
  }
}

/**
 * Track a product scan (camera capture or gallery upload).
 */
export function trackScan(productName?: string): void {
  const params: Record<string, string> = { fb_content_type: 'product_scan' };
  if (productName) params.fb_content = productName;

  // Meta – custom event
  if (MetaAppEventsLogger) {
    try {
      MetaAppEventsLogger.logEvent('ProductScan', params);
      console.log('[AdsAnalytics] Meta: scan tracked');
    } catch (error) {
      console.warn('[AdsAnalytics] Meta scan event failed:', error);
    }
  }

  // TikTok – custom event
  if (TiktokAdsEvents) {
    try {
      const properties = [
        { key: 'content_type', value: 'product_scan' },
        ...(productName ? [{ key: 'content_name', value: productName }] : []),
      ];
      TiktokAdsEvents.trackCustomEvent(
        'ProductScan',
        `scan_${Date.now()}`,
        properties,
      );
      console.log('[AdsAnalytics] TikTok: scan tracked');
    } catch (error) {
      console.warn('[AdsAnalytics] TikTok scan event failed:', error);
    }
  }
}

/**
 * Track a text search query.
 */
export function trackSearch(query: string): void {
  // Meta – standard Search event
  if (MetaAppEventsLogger) {
    try {
      MetaAppEventsLogger.logEvent('fb_mobile_search', {
        fb_search_string: query,
      });
      console.log('[AdsAnalytics] Meta: search tracked –', query);
    } catch (error) {
      console.warn('[AdsAnalytics] Meta search event failed:', error);
    }
  }

  // TikTok – standard search event
  if (TiktokAdsEvents && TikTokStandardEvents) {
    try {
      TiktokAdsEvents.trackTTEvent(TikTokStandardEvents.search, [
        { key: 'query', value: query },
      ]);
      console.log('[AdsAnalytics] TikTok: search tracked –', query);
    } catch (error) {
      console.warn('[AdsAnalytics] TikTok search event failed:', error);
    }
  }
}

/**
 * Track an affiliate link click – the highest-value conversion event.
 */
export function trackLinkClick(
  retailer?: string,
  productName?: string,
  url?: string,
): void {
  const metaParams: Record<string, string> = { fb_content_type: 'product' };
  if (retailer) metaParams.fb_content = retailer;
  if (productName) metaParams.fb_description = productName;
  if (url) metaParams.fb_content_url = url;

  // Meta – custom event (high-value signal for optimisation)
  if (MetaAppEventsLogger) {
    try {
      MetaAppEventsLogger.logEvent('LinkClick', metaParams);
      console.log('[AdsAnalytics] Meta: link click tracked');
    } catch (error) {
      console.warn('[AdsAnalytics] Meta link click event failed:', error);
    }
  }

  // TikTok – custom event
  if (TiktokAdsEvents) {
    try {
      const properties = [
        { key: 'content_type', value: 'product' },
        ...(retailer ? [{ key: 'content_category', value: retailer }] : []),
        ...(productName ? [{ key: 'content_name', value: productName }] : []),
        ...(url ? [{ key: 'description', value: url }] : []),
      ];
      TiktokAdsEvents.trackCustomEvent(
        'LinkClick',
        `link_${Date.now()}`,
        properties,
      );
      console.log('[AdsAnalytics] TikTok: link click tracked');
    } catch (error) {
      console.warn('[AdsAnalytics] TikTok link click event failed:', error);
    }
  }
}
