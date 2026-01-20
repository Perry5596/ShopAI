import { View, Text, ScrollView, Image, TouchableOpacity, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5, FontAwesome6 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSnapStore } from '@/stores';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { analyticsService } from '@/utils/supabase-service';
import type { ProductLink } from '@/types';

/**
 * Guest Results Screen
 * 
 * Displays scan results for guest users without persisting to the database.
 * Results are stored temporarily in snapStore.guestScanResult.
 */
export default function GuestResultsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { guestScanResult, clearGuestResult, lastRateLimitInfo } = useSnapStore();

  // If no guest result, go back
  if (!guestScanResult) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
        <Text className="text-[16px] font-inter-medium text-foreground-muted mt-4">
          No scan results available
        </Text>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          className="mt-4 px-6 py-3 bg-foreground rounded-full">
          <Text className="text-background font-inter-medium">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { imageUri, result, scannedAt } = guestScanResult;
  const products = result.products || [];

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleDone = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearGuestResult();
    router.replace('/(app)/home');
  };

  const handleScanAgain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearGuestResult();
    router.replace('/(app)/snap');
  };

  const handleSignIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearGuestResult();
    router.push('/?showSignIn=true');
  };

  const handleProductPress = async (product: { affiliateUrl: string }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Track link click for authenticated users
    if (user?.id) {
      analyticsService.trackLinkClick(user.id);
    }
    
    try {
      const canOpen = await Linking.canOpenURL(product.affiliateUrl);
      if (canOpen) {
        await Linking.openURL(product.affiliateUrl);
      } else {
        Alert.alert('Error', 'Unable to open this link');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open link');
    }
  };

  /**
   * Get retailer-specific icon
   */
  const getRetailerIcon = (source: string): React.ReactNode => {
    const sourceLower = source.toLowerCase();
    
    if (sourceLower.includes('amazon')) {
      return <FontAwesome5 name="amazon" size={16} color="#FF9900" />;
    }
    if (sourceLower.includes('ebay')) {
      return <Text className="text-[10px] font-bold text-white">eBay</Text>;
    }
    if (sourceLower.includes('target')) {
      return <FontAwesome6 name="bullseye" size={14} color="#CC0000" />;
    }
    if (sourceLower.includes('best buy') || sourceLower.includes('bestbuy')) {
      return <Text className="text-[8px] font-bold text-[#FFE000]">BBY</Text>;
    }
    if (sourceLower.includes('walmart')) {
      return <FontAwesome6 name="star" size={12} color="#FFC220" />;
    }
    return <Ionicons name="bag-outline" size={16} color="#9CA3AF" />;
  };

  const getRetailerBgColor = (source: string): string => {
    const sourceLower = source.toLowerCase();
    
    if (sourceLower.includes('amazon')) return 'bg-[#232F3E]';
    if (sourceLower.includes('ebay')) return 'bg-[#E53238]';
    if (sourceLower.includes('target')) return 'bg-white border border-gray-200';
    if (sourceLower.includes('best buy') || sourceLower.includes('bestbuy')) return 'bg-[#0046BE]';
    if (sourceLower.includes('walmart')) return 'bg-[#0071DC]';
    return 'bg-background-secondary';
  };

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4 py-3 bg-background"
        style={{ paddingTop: insets.top + 8 }}>
        <TouchableOpacity
          onPress={handleDone}
          className="p-2">
          <Ionicons name="close" size={28} color="#000000" />
        </TouchableOpacity>
        
        <Text className="text-[18px] font-inter-semibold text-foreground">
          Scan Results
        </Text>
        
        <View className="w-10" />
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        
        {/* Image Preview */}
        <View className="mx-4 mb-4">
          <Image
            source={{ uri: imageUri }}
            className="w-full h-48 rounded-2xl"
            resizeMode="cover"
          />
        </View>

        {/* Title & Info */}
        <View className="px-5 mb-4">
          <View className="flex-row items-center mb-2">
            <Badge text={`Scanned at ${formatTime(scannedAt)}`} variant="default" />
            {lastRateLimitInfo && (
              <Badge 
                text={`${lastRateLimitInfo.remaining} scans left`} 
                variant="default" 
                className="ml-2"
              />
            )}
          </View>
          
          <Text className="text-[24px] font-bold text-foreground mb-1">
            {result.title || 'Product Found'}
          </Text>
          
          {result.description && (
            <Text className="text-[14px] text-foreground-muted">
              {result.description}
            </Text>
          )}
        </View>

        {/* Guest Notice */}
        <View className="mx-5 mb-4 p-4 bg-background-secondary rounded-2xl">
          <View className="flex-row items-center mb-2">
            <Ionicons name="information-circle" size={20} color="#6B7280" />
            <Text className="text-[14px] font-inter-medium text-foreground-muted ml-2">
              Guest Mode
            </Text>
          </View>
          <Text className="text-[13px] text-foreground-muted">
            Sign in to save your scans and access them later across all your devices.
          </Text>
          <TouchableOpacity
            onPress={handleSignIn}
            className="mt-3 flex-row items-center">
            <Text className="text-[14px] font-inter-semibold text-foreground">
              Sign In
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#000000" />
          </TouchableOpacity>
        </View>

        {/* Products Section */}
        {products.length > 0 ? (
          <View className="px-5">
            <Text className="text-[18px] font-inter-semibold text-foreground mb-3">
              Products Found
            </Text>
            
            {products.map((product, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleProductPress(product)}
                activeOpacity={0.7}
                className="flex-row bg-card rounded-2xl p-3 mb-3"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }}>
                {/* Product Image */}
                {product.imageUrl && (
                  <Image
                    source={{ uri: product.imageUrl }}
                    className="w-20 h-20 rounded-xl mr-3"
                    resizeMode="cover"
                  />
                )}
                
                {/* Product Info */}
                <View className="flex-1 justify-center">
                  {/* Recommended Badge */}
                  {product.isRecommended && (
                    <Badge text="Best Match" variant="success" className="mb-1 self-start" />
                  )}
                  
                  <Text className="text-[15px] font-inter-medium text-foreground mb-1" numberOfLines={2}>
                    {product.title}
                  </Text>
                  
                  <View className="flex-row items-center">
                    {/* Retailer Badge */}
                    <View className={`w-6 h-6 rounded items-center justify-center mr-2 ${getRetailerBgColor(product.source)}`}>
                      {getRetailerIcon(product.source)}
                    </View>
                    <Text className="text-[13px] text-foreground-muted">
                      {product.source}
                    </Text>
                  </View>
                  
                  {/* Price & Rating Row */}
                  <View className="flex-row items-center mt-1">
                    {product.price && (
                      <Text className="text-[16px] font-inter-semibold text-foreground mr-3">
                        {product.price}
                      </Text>
                    )}
                    {product.rating && (
                      <View className="flex-row items-center">
                        <Ionicons name="star" size={14} color="#F59E0B" />
                        <Text className="text-[13px] text-foreground-muted ml-1">
                          {product.rating}
                          {product.reviewCount && ` (${product.reviewCount})`}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                
                {/* Arrow */}
                <View className="justify-center">
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View className="px-5 py-8 items-center">
            <Ionicons name="search-outline" size={48} color="#9CA3AF" />
            <Text className="text-[16px] font-inter-medium text-foreground-muted mt-4 text-center">
              No products found for this image.
            </Text>
            <Text className="text-[14px] text-foreground-subtle mt-2 text-center">
              Try scanning a different product image.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View
        className="absolute bottom-0 left-0 right-0 px-5 bg-background border-t border-border-light"
        style={{ paddingBottom: insets.bottom + 16, paddingTop: 16 }}>
        <View className="flex-row gap-3">
          <Button
            title="Scan Again"
            variant="outline"
            size="lg"
            icon="camera-outline"
            onPress={handleScanAgain}
            className="flex-1"
          />
          <Button
            title="Done"
            variant="primary"
            size="lg"
            onPress={handleDone}
            className="flex-1"
          />
        </View>
      </View>
    </View>
  );
}
