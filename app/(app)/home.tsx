import { useEffect, useState, useCallback, useRef } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, Text, RefreshControl, NativeSyntheticEvent, NativeScrollEvent, TextInput, TouchableOpacity, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header, RecentShops, FeaturedStoreCard } from '@/components/home';
import { BottomTabBar } from '@/components/navigation';
import { CenteredModal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { useShopStore } from '@/stores';
import { useSearchStore } from '@/stores/searchStore';
import { shopService, featuredStoreService, analyticsService } from '@/utils/supabase-service';
import type { Shop, Conversation, FeaturedStore } from '@/types';

// Module-level cache so featured stores survive screen unmount/remount
let _cachedFeaturedStores: FeaturedStore[] = [];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile, user, refreshProfile, isGuest } = useAuth();
  const { shops, isLoading, isLoadingMore, hasMore, error, fetchShops, fetchMoreShops, updateShop } = useShopStore();
  const { conversations, fetchConversations, renameConversation } = useSearchStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [featuredStores, setFeaturedStores] = useState<FeaturedStore[]>(_cachedFeaturedStores);
  const [isEditTitleVisible, setIsEditTitleVisible] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [editingConversation, setEditingConversation] = useState<Conversation | null>(null);

  // Track which shops were processing to detect completion
  const previousProcessingShopsRef = useRef<Set<string>>(new Set());

  // Fetch shops and conversations when user is available
  useEffect(() => {
    if (user?.id) {
      fetchShops(user.id);
      fetchConversations(user.id);
    }
  }, [user?.id, fetchShops, fetchConversations]);

  // Fetch featured stores (public data, no auth needed).
  // Writes to module-level cache so data survives screen remount.
  const loadFeaturedStores = useCallback(async () => {
    try {
      const stores = await featuredStoreService.getActiveFeaturedStores();
      _cachedFeaturedStores = stores;
      setFeaturedStores(stores);
    } catch (err) {
      console.error('Failed to load featured stores:', err);
    }
  }, []);

  useEffect(() => {
    loadFeaturedStores();
  }, [loadFeaturedStores]);

  // Detect when processing shops become completed and refresh profile
  useEffect(() => {
    const currentProcessingShops = new Set(
      shops.filter((s) => s.status === 'processing').map((s) => s.id)
    );
    const previousProcessingShops = previousProcessingShopsRef.current;

    // Check if any previously processing shop is now completed
    let hasNewlyCompleted = false;
    previousProcessingShops.forEach((shopId) => {
      const shop = shops.find((s) => s.id === shopId);
      if (shop && shop.status === 'completed') {
        hasNewlyCompleted = true;
      }
    });

    // If a shop just completed, refresh the profile to get updated stats
    if (hasNewlyCompleted) {
      refreshProfile();
    }

    // Update the ref for next comparison
    previousProcessingShopsRef.current = currentProcessingShops;
  }, [shops, refreshProfile]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    if (!user?.id) return;
    
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchShops(user.id),
        fetchConversations(user.id),
        refreshProfile(),
        loadFeaturedStores(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [user?.id, fetchShops, refreshProfile, loadFeaturedStores]);

  // Load more shops when scrolling near bottom
  const handleLoadMore = useCallback(() => {
    if (!user?.id || isLoadingMore || !hasMore) return;
    fetchMoreShops(user.id);
  }, [user?.id, isLoadingMore, hasMore, fetchMoreShops]);

  // Handle scroll to detect when near bottom
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 50;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    
    if (isCloseToBottom && hasMore && !isLoadingMore) {
      handleLoadMore();
    }
  }, [hasMore, isLoadingMore, handleLoadMore]);

  const handleFeaturedLinkClick = useCallback(() => {
    if (user?.id) {
      analyticsService.trackLinkClick(user.id);
    }
  }, [user?.id]);

  const handleEditTitle = (shop: Shop) => {
    setEditingShop(shop);
    setEditingConversation(null);
    setEditTitleValue(shop.title);
    setIsEditTitleVisible(true);
  };

  const handleEditConversationTitle = (conversation: Conversation) => {
    setEditingConversation(conversation);
    setEditingShop(null);
    setEditTitleValue(conversation.title || '');
    setIsEditTitleVisible(true);
  };

  const handleSaveTitle = async () => {
    if (!editTitleValue.trim()) {
      Alert.alert('Error', 'Title cannot be empty');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const trimmedTitle = editTitleValue.trim();
    setIsEditTitleVisible(false);

    if (editingConversation) {
      // Rename conversation
      try {
        await renameConversation(editingConversation.id, trimmedTitle);
      } catch (error) {
        Alert.alert('Error', 'Failed to update title');
      } finally {
        setEditingConversation(null);
      }
    } else if (editingShop) {
      const originalTitle = editingShop.title;
      
      // Optimistic update
      updateShop(editingShop.id, { title: trimmedTitle });

      try {
        // Update in database
        await shopService.updateShop(editingShop.id, { title: trimmedTitle });
      } catch (error) {
        // Revert on error
        updateShop(editingShop.id, { title: originalTitle });
        Alert.alert('Error', 'Failed to update title');
        setIsEditTitleVisible(true);
        setEditTitleValue(trimmedTitle);
      } finally {
        setEditingShop(null);
      }
    }
  };

  const handleCancelEditTitle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsEditTitleVisible(false);
    setEditTitleValue('');
    setEditingShop(null);
    setEditingConversation(null);
  };

  return (
    <LinearGradient
      colors={['#EBEBED', '#F5F5F7']}
      locations={[0, 0.25]}
      style={{ flex: 1 }}>
      {/* Content - Header scrolls with content */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 140 }}
        onScroll={handleScroll}
        scrollEventThrottle={400}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#000000"
            progressViewOffset={insets.top}
          />
        }>
        {/* Header */}
        <Header streak={profile?.currentStreak ?? 0} />

        {/* Featured Store Section */}
        {featuredStores.length > 0 && (
          <View className="pt-4 mb-4">
            <FeaturedStoreCard stores={featuredStores} onLinkClick={handleFeaturedLinkClick} />
          </View>
        )}

        {/* Loading State */}
        {isLoading && shops.length === 0 && (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" color="#000000" />
            <Text className="text-[14px] font-inter text-foreground-muted mt-3">
              Loading your shops...
            </Text>
          </View>
        )}

        {/* Error State */}
        {error && shops.length === 0 && (
          <View className="items-center justify-center py-12 px-8">
            <Text className="text-[16px] font-inter-medium text-red-500 text-center">
              {error}
            </Text>
          </View>
        )}

        {/* Recent Shops - show cached shops even during background refresh */}
        {(shops.length > 0 || !isLoading) && (
          <View>
            <RecentShops 
              shops={shops}
              conversations={conversations}
              isLoadingMore={isLoadingMore}
              hasMore={hasMore}
              onEditTitle={handleEditTitle}
              onEditConversationTitle={handleEditConversationTitle}
            />
          </View>
        )}
      </ScrollView>

      {/* Gradient fade for safe area at top */}
      <LinearGradient
        colors={[
          'rgba(255,255,255,0.95)', 
          'rgba(255,255,255,0.6)', 
          'rgba(255,255,255,0.0)'
        ]}
        locations={[0, 0.35, 0.5]}
        style={[styles.blurOverlay, { height: insets.top * 2 }]}
        pointerEvents="none"
      />

      {/* Bottom Tab Bar */}
      <BottomTabBar />

      {/* Edit Title Modal - rendered at screen level for proper overlay */}
      <CenteredModal isVisible={isEditTitleVisible} onClose={handleCancelEditTitle}>
        <View className="p-6">
          <Text className="text-[20px] font-inter-semibold text-foreground mb-4">
            Edit Title
          </Text>
          <TextInput
            value={editTitleValue}
            onChangeText={setEditTitleValue}
            placeholder={editingConversation ? "Enter search title" : "Enter shop title"}
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
