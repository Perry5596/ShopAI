import { View, Text, ScrollView, TouchableOpacity, Alert, Share, ActivityIndicator, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ShopHeader, ProductImage, ProductLinks, ActionButtons } from '@/components/shop';
import { Badge } from '@/components/ui/Badge';
import { CircularProgress } from '@/components/ui/CircularProgress';
import { CenteredModal } from '@/components/ui/Modal';
import { useShopStore } from '@/stores';
import { useAuth } from '@/contexts/AuthContext';
import { shopService } from '@/utils/supabase-service';
import type { Shop } from '@/types';

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

  const handleShare = async () => {
    if (!shop) return;
    try {
      const shareMessage = shop.recommendation
        ? `${shop.recommendation.affiliateUrl}`
        : `Check out this ${shop.title} I found on Shop AI!`;
      
      await Share.share({
        message: shareMessage,
        title: shop.title,
        url: shop.recommendation?.affiliateUrl,
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
              <CircularProgress size={80} strokeWidth={6} color="#000000" backgroundColor="#E5E7EB" textColor="#000000" duration={10000} startTime={shop.createdAt} />
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
    </View>
  );
}
