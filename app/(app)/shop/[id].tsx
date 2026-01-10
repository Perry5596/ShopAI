import { View, Text, ScrollView, TouchableOpacity, Alert, Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ShopHeader, ProductImage, ProductLinks, ActionButtons, StageIndicator, StoreStatusRow } from '@/components/shop';
import { Badge } from '@/components/ui/Badge';
import { useShopStore, useSessionStore } from '@/stores';
import { useAuth } from '@/contexts/AuthContext';
import type { Shop } from '@/types';

export default function ShopDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { shops, getShopById, toggleFavorite, deleteShop } = useShopStore();
  const { 
    activeSession, 
    hypothesis, 
    storeResults, 
    startPolling, 
    stopPolling, 
    getStoreStatuses,
    reset: resetSession 
  } = useSessionStore();
  
  // Get shop from store - this will update when the store updates
  const shop = getShopById(id || '');
  const [isFavorite, setIsFavorite] = useState(shop?.isFavorite ?? false);

  // Start polling when viewing a processing shop with a session
  useEffect(() => {
    if (shop?.status === 'processing' && shop?.sessionId) {
      startPolling(shop.sessionId);
    }

    return () => {
      stopPolling();
    };
  }, [shop?.status, shop?.sessionId]);

  // Clean up session when leaving the screen
  useEffect(() => {
    return () => {
      resetSession();
    };
  }, []);

  // Update local favorite state when shop changes
  useEffect(() => {
    if (shop) {
      setIsFavorite(shop.isFavorite);
    }
  }, [shop?.isFavorite]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleShare = async () => {
    if (!shop) return;
    try {
      await Share.share({
        message: `Check out this ${shop.title} I found on Shop AI!`,
        title: shop.title,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share');
    }
  };

  const handleMenu = () => {
    if (!shop || !user?.id) return;
    Alert.alert(
      'Options',
      '',
      [
        { text: 'Edit Title', onPress: () => Alert.alert('Edit Title') },
        { 
          text: 'Delete Shop', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await deleteShop(shop.id, user.id);
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete shop');
            }
          }
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleFavoriteToggle = async () => {
    if (!shop) return;
    
    // Optimistic update
    setIsFavorite(!isFavorite);
    
    try {
      await toggleFavorite(shop.id);
    } catch (error) {
      // Revert on error
      setIsFavorite(isFavorite);
      Alert.alert('Error', 'Failed to update favorite');
    }
  };

  const handleDone = () => {
    router.back();
  };

  // Shop not found
  if (!shop) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
        <Text className="text-[16px] font-inter-medium text-foreground-muted mt-4">
          Shop not found
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 px-6 py-3 bg-foreground rounded-full">
          <Text className="text-background font-inter-medium">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Processing state - with progressive updates
  if (shop.status === 'processing') {
    const sessionStatus = activeSession?.status || 'identifying';
    const storeStatuses = getStoreStatuses();
    const productName = hypothesis?.productName;

    return (
      <View className="flex-1 bg-background">
        <ShopHeader onShare={handleShare} onMenu={handleMenu} />
        
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}>
          <ProductImage imageUrl={shop.imageUrl} />
          
          <View className="bg-background rounded-t-3xl -mt-6 pt-5">
            {/* Stage Indicator with product name */}
            <StageIndicator 
              status={sessionStatus} 
              productName={productName}
            />

            {/* Store Status Chips - show during searching phase */}
            {(sessionStatus === 'searching' || sessionStatus === 'ranking') && (
              <StoreStatusRow stores={storeStatuses} />
            )}

            {/* Show partial results if we have any */}
            {storeResults.length > 0 && (
              <View className="px-5 mt-4">
                <Text className="text-[14px] font-inter-medium text-foreground-muted mb-2">
                  Found {storeResults.reduce((sum, r) => sum + (r.candidates?.length || 0), 0)} products so far...
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
        
        <ActionButtons shopId={shop.id} onDone={handleDone} />
      </View>
    );
  }

  // Failed state
  if (shop.status === 'failed') {
    return (
      <View className="flex-1 bg-background">
        <ShopHeader onShare={handleShare} onMenu={handleMenu} />
        
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}>
          <ProductImage imageUrl={shop.imageUrl} />
          
          <View className="bg-background rounded-t-3xl -mt-6 pt-5 px-5">
            <View className="items-center py-8">
              <View className="w-16 h-16 rounded-full bg-red-100 items-center justify-center mb-4">
                <Ionicons name="alert-circle" size={32} color="#EF4444" />
              </View>
              <Text className="text-[18px] font-inter-semibold text-foreground">
                Analysis Failed
              </Text>
              <Text className="text-[14px] font-inter text-foreground-muted mt-2 text-center px-4">
                {shop.description || 'We couldn\'t analyze this image. Please try again.'}
              </Text>
            </View>
          </View>
        </ScrollView>
        
        <ActionButtons shopId={shop.id} onDone={handleDone} />
      </View>
    );
  }

  // Completed state - normal view
  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <ShopHeader onShare={handleShare} onMenu={handleMenu} />

      {/* Content */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Product Image */}
        <ProductImage imageUrl={shop.imageUrl} />

        {/* Info Panel */}
        <View className="bg-background rounded-t-3xl -mt-6 pt-5 px-5">
          {/* Title Row */}
          <View className="flex-row items-start justify-between mb-2">
            {/* Favorite & Timestamp */}
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={handleFavoriteToggle}
                activeOpacity={0.7}
                className="mr-3">
                <Ionicons
                  name={isFavorite ? 'bookmark' : 'bookmark-outline'}
                  size={24}
                  color={isFavorite ? '#000000' : '#6B7280'}
                />
              </TouchableOpacity>
              <Badge text={formatTime(shop.createdAt)} variant="default" />
            </View>
          </View>

          {/* Title */}
          <Text className="text-[24px] font-bold text-foreground mb-1">
            {shop.title}
          </Text>

          {shop.description && (
            <Text className="text-[14px] text-foreground-muted mb-4">
              {shop.description}
            </Text>
          )}
        </View>

        {/* Product Links */}
        <ProductLinks
          links={shop.products}
          recommendation={shop.recommendation}
        />
      </ScrollView>

      {/* Action Buttons */}
      <ActionButtons shopId={shop.id} onDone={handleDone} />
    </View>
  );
}
