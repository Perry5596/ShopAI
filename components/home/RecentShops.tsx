import { View, Text, Image, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { CircularProgress } from '@/components/ui/CircularProgress';
import { useAuth } from '@/contexts/AuthContext';
import { useShopStore } from '@/stores';
import { useSearchStore } from '@/stores/searchStore';
import type { Shop, Conversation } from '@/types';

// ============================================================================
// Unified Feed Item
// ============================================================================

export type FeedItem =
  | { type: 'shop'; data: Shop; date: string }
  | { type: 'conversation'; data: Conversation; date: string };

interface RecentShopsProps {
  shops: Shop[];
  conversations: Conversation[];
  isLoadingMore?: boolean;
  hasMore?: boolean;
  onEditTitle: (shop: Shop) => void;
  onEditConversationTitle: (conversation: Conversation) => void;
}

// ============================================================================
// Date Formatting Helper
// ============================================================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const isToday = today.getTime() === itemDate.getTime();

  if (isToday) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}

// ============================================================================
// Shop Item (existing scan items)
// ============================================================================

interface ShopItemProps {
  shop: Shop;
  onEditTitle: (shop: Shop) => void;
}

function ShopItem({ shop, onEditTitle }: ShopItemProps) {
  const { user } = useAuth();
  const { deleteShop, toggleFavorite } = useShopStore();

  const handleLongPress = () => {
    if (!shop || !user?.id) return;
    Alert.alert(
      'Options',
      '',
      [
        { 
          text: 'Edit Title', 
          onPress: () => {
            onEditTitle(shop);
          }
        },
        { 
          text: shop.isFavorite ? 'Remove from Favorites' : 'Add to Favorites', 
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              await toggleFavorite(shop.id);
            } catch (error) {
              Alert.alert('Error', 'Failed to update favorite status');
            }
          }
        },
        { 
          text: 'Delete Shop', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await deleteShop(shop.id, user.id);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete shop');
            }
          }
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const isProcessing = shop.status === 'processing';
  const isFailed = shop.status === 'failed';

  return (
    <TouchableOpacity
      className="flex-row bg-card rounded-2xl overflow-hidden mb-3"
      activeOpacity={0.7}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/(app)/shop/${shop.id}`);
      }}
      onLongPress={handleLongPress}
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
      }}>
      {/* Thumbnail */}
      <View className="w-28 h-28 bg-background-secondary relative">
        {shop.imageUrl ? (
          <View className="w-full h-full">
            <Image
              source={{ uri: shop.imageUrl }}
              className="w-full h-full"
              resizeMode="cover"
            />
            {shop.isFavorite && (
              <View className="absolute top-1.5 right-1.5 bg-black/30 rounded-full p-1">
                <Ionicons name="star" size={14} color="#FFD700" />
              </View>
            )}
            {isProcessing && (
              <View className="absolute inset-0 bg-black/40 items-center justify-center">
                <CircularProgress size={40} strokeWidth={3} color="#FFFFFF" backgroundColor="rgba(255, 255, 255, 0.3)" textColor="#FFFFFF" duration={10000} startTime={shop.createdAt} />
              </View>
            )}
            {isFailed && (
              <View className="absolute inset-0 bg-red-500/20 items-center justify-center">
                <Ionicons name="alert-circle" size={24} color="#EF4444" />
              </View>
            )}
          </View>
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Ionicons name="image-outline" size={32} color="#9CA3AF" />
            {shop.isFavorite && (
              <View className="absolute top-1.5 right-1.5 bg-black/30 rounded-full p-1">
                <Ionicons name="star" size={14} color="#FFD700" />
              </View>
            )}
          </View>
        )}
      </View>

      {/* Content */}
      <View className="flex-1 p-3 justify-center">
        <View className="flex-row items-center justify-between mb-1">
          {isProcessing ? (
            <View className="flex-row items-center flex-1">
              <Text
                className="text-[16px] font-inter-medium text-foreground-muted flex-1"
                numberOfLines={1}>
                Analyzing...
              </Text>
            </View>
          ) : (
            <Text
              className={`text-[16px] font-inter-medium flex-1 ${isFailed ? 'text-red-500' : 'text-foreground'}`}
              numberOfLines={1}>
              {isFailed ? 'Analysis Failed' : shop.title}
            </Text>
          )}
          <Text className="text-[12px] font-inter text-foreground-muted ml-2">
            {formatDate(shop.createdAt)}
          </Text>
        </View>

        {isProcessing && (
          <View className="flex-row items-center mt-1">
            <Ionicons name="hourglass-outline" size={14} color="#6B7280" />
            <Text className="text-[13px] font-inter text-foreground-muted ml-1">
              Finding products...
            </Text>
          </View>
        )}

        {isFailed && (
          <View className="flex-row items-center mt-1">
            <Ionicons name="refresh-outline" size={14} color="#EF4444" />
            <Text className="text-[13px] font-inter text-red-500 ml-1">
              Tap to view details
            </Text>
          </View>
        )}

        {!isProcessing && !isFailed && (
          <>
            {shop.products.length > 0 && (
              <View className="flex-row items-center mt-1">
                <Ionicons name="link-outline" size={14} color="#6B7280" />
                <Text className="text-[13px] font-inter text-foreground-muted ml-1">
                  {shop.products.length} link{shop.products.length !== 1 ? 's' : ''} found
                </Text>
              </View>
            )}

            {shop.recommendation && (
              <View className="flex-row items-center mt-1">
                <Ionicons name="sparkles" size={14} color="#F59E0B" />
                <Text className="text-[13px] font-inter text-amber-600 ml-1" numberOfLines={1}>
                  {shop.recommendation.title}
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Chevron */}
      <View className="justify-center pr-3">
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );
}

// ============================================================================
// Conversation Item (text search items)
// ============================================================================

interface ConversationItemProps {
  conversation: Conversation;
  onEditTitle: (conversation: Conversation) => void;
}

function ConversationItem({ conversation, onEditTitle }: ConversationItemProps) {
  const { user } = useAuth();
  const { loadConversation, deleteConversation, toggleConversationFavorite } = useSearchStore();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadConversation(conversation.id);
    router.push('/(app)/search' as any);
  };

  const handleLongPress = () => {
    if (!user?.id) return;
    Alert.alert(
      'Options',
      '',
      [
        {
          text: 'Rename',
          onPress: () => {
            onEditTitle(conversation);
          },
        },
        {
          text: conversation.isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              await toggleConversationFavorite(conversation.id);
            } catch (error) {
              Alert.alert('Error', 'Failed to update favorite status');
            }
          },
        },
        {
          text: 'Delete Search',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteConversation(conversation.id);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete search');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Use cached summary fields from the conversation (survive refresh).
  // Fall back to computing from messages for backward compat / in-session data.
  const totalProducts =
    conversation.totalProducts > 0
      ? conversation.totalProducts
      : (conversation.messages || []).reduce((sum, msg) => {
          if (msg.categories) {
            return sum + msg.categories.reduce((catSum, cat) => catSum + (cat.products?.length || 0), 0);
          }
          return sum;
        }, 0);

  const totalCategories =
    conversation.totalCategories > 0
      ? conversation.totalCategories
      : (conversation.messages || []).reduce((sum, msg) => {
          return sum + (msg.categories?.length || 0);
        }, 0);

  // Thumbnail: use the stored thumbnail_url, or fall back to computing
  // from the first AI pick in messages for in-session data.
  let thumbnailUrl = conversation.thumbnailUrl;
  if (!thumbnailUrl && conversation.messages?.length) {
    for (const msg of conversation.messages) {
      if (msg.categories && msg.categories.length > 0) {
        const firstCat = msg.categories[0];
        if (firstCat.products?.length > 0) {
          const productWithImage = firstCat.products.find((p) => p.imageUrl);
          if (productWithImage) {
            thumbnailUrl = productWithImage.imageUrl;
            break;
          }
        }
      }
    }
  }

  return (
    <TouchableOpacity
      className="flex-row bg-card rounded-2xl overflow-hidden mb-3"
      activeOpacity={0.7}
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
      }}>
      {/* Thumbnail */}
      <View className="w-28 h-28 bg-background-secondary items-center justify-center relative">
        {thumbnailUrl ? (
          <Image
            source={{ uri: thumbnailUrl }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="w-14 h-14 rounded-full bg-gray-200 items-center justify-center">
            <Ionicons name="search" size={28} color="#6B7280" />
          </View>
        )}
        {conversation.isFavorite && (
          <View className="absolute top-1.5 right-1.5 bg-black/30 rounded-full p-1">
            <Ionicons name="star" size={14} color="#FFD700" />
          </View>
        )}
      </View>

      {/* Content */}
      <View className="flex-1 p-3 justify-center">
        <View className="flex-row items-center justify-between mb-1">
          <Text
            className="text-[16px] font-inter-medium text-foreground flex-1"
            numberOfLines={1}>
            {conversation.title || 'Text Search'}
          </Text>
          <Text className="text-[12px] font-inter text-foreground-muted ml-2">
            {formatDate(conversation.createdAt)}
          </Text>
        </View>

        {/* Type badge */}
        <View className="flex-row items-center mt-1">
          <View className="bg-blue-50 px-2 py-0.5 rounded-full mr-2">
            <Text className="text-[11px] font-inter-medium text-blue-600">
              AI Search
            </Text>
          </View>
          {totalCategories > 0 && (
            <Text className="text-[13px] font-inter text-foreground-muted">
              {totalCategories} categor{totalCategories !== 1 ? 'ies' : 'y'}
            </Text>
          )}
        </View>

        {totalProducts > 0 && (
          <View className="flex-row items-center mt-1">
            <Ionicons name="bag-outline" size={14} color="#6B7280" />
            <Text className="text-[13px] font-inter text-foreground-muted ml-1">
              {totalProducts} product{totalProducts !== 1 ? 's' : ''} found
            </Text>
          </View>
        )}
      </View>

      {/* Chevron */}
      <View className="justify-center pr-3">
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );
}

// ============================================================================
// Unified Feed Section
// ============================================================================

type FeedSection = {
  title: string;
  items: FeedItem[];
};

function buildFeedSections(shops: Shop[], conversations: Conversation[]): FeedSection[] {
  // Merge into unified feed items
  const items: FeedItem[] = [
    ...shops.map((shop): FeedItem => ({
      type: 'shop',
      data: shop,
      date: shop.createdAt,
    })),
    ...conversations.map((conv): FeedItem => ({
      type: 'conversation',
      data: conv,
      date: conv.createdAt,
    })),
  ];

  // Sort by date descending
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Group by time period
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const sections: FeedSection[] = [
    { title: 'Today', items: [] },
    { title: 'This Week', items: [] },
    { title: 'This Month', items: [] },
    { title: 'Older', items: [] },
  ];

  items.forEach((item) => {
    const itemDate = new Date(item.date);
    const itemDateOnly = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
    const daysDiff = Math.floor((today.getTime() - itemDateOnly.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) {
      sections[0].items.push(item);
    } else if (daysDiff <= 7) {
      sections[1].items.push(item);
    } else if (daysDiff <= 30) {
      sections[2].items.push(item);
    } else {
      sections[3].items.push(item);
    }
  });

  return sections.filter((section) => section.items.length > 0);
}

// ============================================================================
// Main Component
// ============================================================================

export function RecentShops({ shops, conversations, isLoadingMore, hasMore, onEditTitle, onEditConversationTitle }: RecentShopsProps) {
  const { isGuest } = useAuth();

  const totalItems = shops.length + conversations.length;

  if (totalItems === 0) {
    if (isGuest) {
      return (
        <View className="items-center justify-center py-12 px-8">
          <View className="w-16 h-16 rounded-full bg-background-secondary items-center justify-center mb-4">
            <Ionicons name="person-outline" size={32} color="#9CA3AF" />
          </View>
          <Text className="text-[16px] font-inter-medium text-foreground-muted text-center">
            Sign in to save your scans
          </Text>
          <Text className="text-[14px] font-inter text-foreground-subtle mt-1 text-center">
            Your scans will be saved and accessible across all your devices
          </Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/?showSignIn=true');
            }}
            activeOpacity={0.7}
            className="mt-4 px-6 py-3 bg-foreground rounded-full">
            <Text className="text-[14px] font-inter-semibold text-background">
              Sign In
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View className="items-center justify-center py-12">
        <View className="w-16 h-16 rounded-full bg-background-secondary items-center justify-center mb-4">
          <Ionicons name="bag-outline" size={32} color="#9CA3AF" />
        </View>
        <Text className="text-[16px] font-inter-medium text-foreground-muted">No shops yet</Text>
        <Text className="text-[14px] font-inter text-foreground-subtle mt-1 text-center px-8">
          Tap the + button to scan or search for your first item
        </Text>
      </View>
    );
  }

  const sections = buildFeedSections(shops, conversations);

  return (
    <View>
      <Text className="text-[18px] font-inter-semibold text-foreground mb-4 px-5">
        Recent shops
      </Text>
      <View className="px-5">
        {sections.map((section, sectionIndex) => (
          <View key={section.title}>
            {/* Section Header */}
            <Text className={`text-[14px] font-inter-semibold text-foreground-muted mb-3 ${sectionIndex === 0 ? '' : 'mt-4'}`}>
              {section.title}
            </Text>
            
            {/* Section Items */}
            {section.items.map((item) => {
              if (item.type === 'shop') {
                return <ShopItem key={`shop-${item.data.id}`} shop={item.data} onEditTitle={onEditTitle} />;
              }
              return <ConversationItem key={`conv-${item.data.id}`} conversation={item.data} onEditTitle={onEditConversationTitle} />;
            })}
          </View>
        ))}
        
        {/* Loading more indicator */}
        {isLoadingMore && (
          <View className="items-center py-4">
            <ActivityIndicator size="small" color="#000000" />
            <Text className="text-[13px] font-inter text-foreground-muted mt-2">
              Loading more...
            </Text>
          </View>
        )}
        
        {/* End of list indicator */}
        {!hasMore && totalItems > 0 && (
          <View className="items-center py-4">
            <Text className="text-[13px] font-inter text-foreground-subtle">
              You&apos;ve seen all your shops
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
