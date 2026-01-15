import { View, Text, ScrollView, TouchableOpacity, Alert, Share, ActivityIndicator, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesome5, FontAwesome6 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ShopHeader, ProductImage, ProductLinks, ActionButtons } from '@/components/shop';
import { Badge } from '@/components/ui/Badge';
import { CircularProgress } from '@/components/ui/CircularProgress';
import { CenteredModal, FadeModal } from '@/components/ui/Modal';
import { useShopStore } from '@/stores';
import { useAuth } from '@/contexts/AuthContext';
import { shopService } from '@/utils/supabase-service';
import type { Shop, ProductLink } from '@/types';

export default function ShopDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { shops, getShopById, toggleFavorite, deleteShop, addShop, updateShop } = useShopStore();
  
  // Get shop from store - this will update when the store updates
  const shop = getShopById(id || '');
  const [isFavorite, setIsFavorite] = useState(shop?.isFavorite ?? false);
  const [isLoadingShop, setIsLoadingShop] = useState(false);
  const [shopLoadError, setShopLoadError] = useState<string | null>(null);
  const [isEditTitleVisible, setIsEditTitleVisible] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [isShareSheetVisible, setIsShareSheetVisible] = useState(false);

  // Update local favorite state when shop changes
  useEffect(() => {
    if (shop) {
      setIsFavorite(shop.isFavorite);
    }
  }, [shop?.isFavorite]);

  // Fetch shop from Supabase if not in cache
  useEffect(() => {
    const shopId = id || '';
    if (!shopId) return;

    // Check if shop is in cache
    const cachedShop = getShopById(shopId);
    if (cachedShop) {
      // Shop is in cache, no need to fetch
      setIsLoadingShop(false);
      setShopLoadError(null);
      return;
    }

    // Shop not in cache, fetch from Supabase
    let cancelled = false;

    const fetchShop = async () => {
      setIsLoadingShop(true);
      setShopLoadError(null);
      try {
        const fetchedShop = await shopService.getShopById(shopId);
        if (cancelled) return;
        
        if (fetchedShop) {
          // Add to store cache
          addShop(fetchedShop);
        } else {
          setShopLoadError('Shop not found');
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to fetch shop:', error);
        setShopLoadError(error instanceof Error ? error.message : 'Failed to load shop');
      } finally {
        if (!cancelled) {
          setIsLoadingShop(false);
        }
      }
    };

    fetchShop();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    
    // Format date
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
    
    // Format time
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    
    return `${dateStr}, ${timeStr}`;
  };

  const handleShare = () => {
    if (!shop || shop.products.length === 0) {
      Alert.alert('Nothing to share', 'No products available to share.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsShareSheetVisible(true);
  };

  const handleShareProduct = async (product: ProductLink) => {
    setIsShareSheetVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      await Share.share({
        message: product.affiliateUrl,
        title: `${shop?.title} on ${product.source}`,
        url: product.affiliateUrl,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share');
    }
  };

  /**
   * Get retailer-specific icon for share sheet
   */
  const getRetailerIcon = (source: string): React.ReactNode => {
    const sourceLower = source.toLowerCase();
    
    if (sourceLower.includes('amazon')) {
      return <FontAwesome5 name="amazon" size={20} color="#FF9900" />;
    }
    if (sourceLower.includes('ebay')) {
      return <Text className="text-[12px] font-bold text-white">eBay</Text>;
    }
    if (sourceLower.includes('target')) {
      return <FontAwesome6 name="bullseye" size={18} color="#CC0000" />;
    }
    if (sourceLower.includes('best buy') || sourceLower.includes('bestbuy')) {
      return <Text className="text-[10px] font-bold text-[#FFE000]">BBY</Text>;
    }
    if (sourceLower.includes('walmart')) {
      return <FontAwesome6 name="star" size={16} color="#FFC220" />;
    }
    return <Ionicons name="bag-outline" size={20} color="#9CA3AF" />;
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

  const handleMenu = () => {
    if (!shop || !user?.id) return;
    Alert.alert(
      'Options',
      '',
      [
        { 
          text: 'Edit Title', 
          onPress: () => {
            setEditTitleValue(shop.title);
            setIsEditTitleVisible(true);
          }
        },
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

  const handleSaveTitle = async () => {
    if (!shop || !editTitleValue.trim()) {
      Alert.alert('Error', 'Title cannot be empty');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const trimmedTitle = editTitleValue.trim();
    const originalTitle = shop.title;
    
    // Optimistic update
    updateShop(shop.id, { title: trimmedTitle });
    setIsEditTitleVisible(false);

    try {
      // Update in database
      await shopService.updateShop(shop.id, { title: trimmedTitle });
    } catch (error) {
      // Revert on error
      updateShop(shop.id, { title: originalTitle });
      Alert.alert('Error', 'Failed to update title');
      setIsEditTitleVisible(true);
      setEditTitleValue(trimmedTitle);
    }
  };

  const handleCancelEditTitle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsEditTitleVisible(false);
    setEditTitleValue('');
  };

  const handleFavoriteToggle = async () => {
    if (!shop) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  // Loading shop from Supabase
  if (!shop && isLoadingShop) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#000000" />
        <Text className="text-[16px] font-inter-medium text-foreground-muted mt-4">
          Loading shop...
        </Text>
      </View>
    );
  }

  // Shop not found (after loading attempt)
  if (!shop) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
        <Text className="text-[16px] font-inter-medium text-foreground-muted mt-4">
          {shopLoadError || 'Shop not found'}
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

  // Processing state
  if (shop.status === 'processing') {
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
              <CircularProgress size={80} strokeWidth={6} color="#000000" backgroundColor="#E5E7EB" textColor="#000000" duration={15000} startTime={shop.updatedAt} />
              <Text className="text-[18px] font-inter-semibold text-foreground mt-4">
                Analyzing your image...
              </Text>
              <Text className="text-[14px] font-inter text-foreground-muted mt-2 text-center">
                Finding the best products and deals for you
              </Text>
            </View>
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

      {/* Edit Title Modal */}
      <CenteredModal isVisible={isEditTitleVisible} onClose={handleCancelEditTitle}>
        <View className="p-6">
          <Text className="text-[20px] font-inter-semibold text-foreground mb-4">
            Edit Title
          </Text>
          <TextInput
            value={editTitleValue}
            onChangeText={setEditTitleValue}
            placeholder="Enter shop title"
            placeholderTextColor="#9CA3AF"
            className="border border-border-light rounded-xl px-4 py-3 text-[16px] font-inter text-foreground bg-card mb-4"
            autoFocus
            multiline
            maxLength={200}
          />
          <View className="flex-row justify-end gap-3">
            <TouchableOpacity
              onPress={handleCancelEditTitle}
              className="px-6 py-3 rounded-xl">
              <Text className="text-[16px] font-inter-medium text-foreground-muted">
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveTitle}
              className="px-6 py-3 bg-foreground rounded-xl">
              <Text className="text-[16px] font-inter-medium text-background">
                Save
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </CenteredModal>

      {/* Share Modal */}
      <FadeModal
        isVisible={isShareSheetVisible}
        onClose={() => setIsShareSheetVisible(false)}>
        <View className="p-5">
          <Text className="text-[18px] font-inter-semibold text-foreground mb-4 text-center">
            Share from
          </Text>
          
          <ScrollView 
            showsVerticalScrollIndicator={true}
            style={{ maxHeight: 400 }}
            contentContainerStyle={{ paddingBottom: 8 }}>
            {shop.products.map((product, index) => (
              <TouchableOpacity
                key={product.id}
                onPress={() => handleShareProduct(product)}
                activeOpacity={0.7}
                className={`flex-row items-center py-3 ${index < shop.products.length - 1 ? 'border-b border-border-light' : ''}`}>
                {/* Retailer Icon */}
                <View className={`w-10 h-10 rounded-lg items-center justify-center mr-3 ${getRetailerBgColor(product.source)}`}>
                  {getRetailerIcon(product.source)}
                </View>
                
                {/* Product Info */}
                <View className="flex-1 mr-2">
                  <Text className="text-[16px] font-inter-medium text-foreground mb-1" numberOfLines={2}>
                    {product.title}
                  </Text>
                  <Text className="text-[14px] text-foreground-muted mb-1">
                    {product.source}
                  </Text>
                  {product.price && (
                    <Text className="text-[14px] font-inter-semibold text-foreground">
                      {product.price}
                    </Text>
                  )}
                </View>
                
                {/* Share Icon */}
                <Ionicons name="share-outline" size={22} color="#6B7280" />
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {/* Cancel Button */}
          <TouchableOpacity
            onPress={() => setIsShareSheetVisible(false)}
            activeOpacity={0.7}
            className="mt-4 py-3 items-center border-t border-border-light">
            <Text className="text-[16px] font-inter-medium text-foreground-muted">
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </FadeModal>
    </View>
  );
}
