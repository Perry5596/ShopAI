import { View, Text, ScrollView, Switch, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/ui/IconButton';
import { Card } from '@/components/ui/Card';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { profileService } from '@/utils/supabase-service';

interface PreferenceToggle {
  id: string;
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export default function PreferencesScreen() {
  const insets = useSafeAreaInsets();
  const { profile, user, refreshProfile } = useAuth();
  
  // State for favorite stores - default to false
  const [favoriteAmazon, setFavoriteAmazon] = useState(false);
  const [favoriteTarget, setFavoriteTarget] = useState(false);
  const [favoriteBestBuy, setFavoriteBestBuy] = useState(false);
  const [favoriteWalmart, setFavoriteWalmart] = useState(false);
  const [favoriteEbay, setFavoriteEbay] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load favorite stores from profile
  useEffect(() => {
    if (profile) {
      setFavoriteAmazon(profile.favoriteAmazon ?? false);
      setFavoriteTarget(profile.favoriteTarget ?? false);
      setFavoriteBestBuy(profile.favoriteBestBuy ?? false);
      setFavoriteWalmart(profile.favoriteWalmart ?? false);
      setFavoriteEbay(profile.favoriteEbay ?? false);
      setIsLoading(false);
    }
  }, [profile]);

  // Handler to update favorite store
  const handleStoreToggle = async (store: string, value: boolean) => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to update preferences.');
      return;
    }

    try {
      // Update local state immediately for responsive UI
      switch (store) {
        case 'amazon':
          setFavoriteAmazon(value);
          break;
        case 'target':
          setFavoriteTarget(value);
          break;
        case 'bestBuy':
          setFavoriteBestBuy(value);
          break;
        case 'walmart':
          setFavoriteWalmart(value);
          break;
        case 'ebay':
          setFavoriteEbay(value);
          break;
      }

      // Map store name to the correct property name for Supabase
      const storeUpdate: {
        amazon?: boolean;
        target?: boolean;
        bestBuy?: boolean;
        walmart?: boolean;
        ebay?: boolean;
      } = {};
      
      switch (store) {
        case 'amazon':
          storeUpdate.amazon = value;
          break;
        case 'target':
          storeUpdate.target = value;
          break;
        case 'bestBuy':
          storeUpdate.bestBuy = value;
          break;
        case 'walmart':
          storeUpdate.walmart = value;
          break;
        case 'ebay':
          storeUpdate.ebay = value;
          break;
      }

      // Update in Supabase
      await profileService.updateFavoriteStores(user.id, storeUpdate);

      // Refresh profile to sync with database
      await refreshProfile();
    } catch (error) {
      console.error('Failed to update favorite store:', error);
      Alert.alert('Error', 'Failed to update favorite store. Please try again.');
      
      // Revert local state on error
      switch (store) {
        case 'amazon':
          setFavoriteAmazon(!value);
          break;
        case 'target':
          setFavoriteTarget(!value);
          break;
        case 'bestBuy':
          setFavoriteBestBuy(!value);
          break;
        case 'walmart':
          setFavoriteWalmart(!value);
          break;
        case 'ebay':
          setFavoriteEbay(!value);
          break;
      }
    }
  };

  const favoriteStores: PreferenceToggle[] = [
    {
      id: 'amazon',
      title: 'Amazon',
      description: 'Include more Amazon products in your search results.',
      value: favoriteAmazon,
      onChange: (value) => handleStoreToggle('amazon', value),
    },
    {
      id: 'target',
      title: 'Target',
      description: 'Include more Target products in your search results.',
      value: favoriteTarget,
      onChange: (value) => handleStoreToggle('target', value),
    },
    {
      id: 'best-buy',
      title: 'Best Buy',
      description: 'Include more Best Buy products in your search results.',
      value: favoriteBestBuy,
      onChange: (value) => handleStoreToggle('bestBuy', value),
    },
    {
      id: 'walmart',
      title: 'Walmart',
      description: 'Include more Walmart products in your search results.',
      value: favoriteWalmart,
      onChange: (value) => handleStoreToggle('walmart', value),
    },
    {
      id: 'ebay',
      title: 'eBay',
      description: 'Include more eBay products in your search results.',
      value: favoriteEbay,
      onChange: (value) => handleStoreToggle('ebay', value),
    },
  ];

  return (
    <View className="flex-1 bg-background-secondary">
      {/* Header */}
      <View
        className="bg-background-secondary"
        style={{ paddingTop: insets.top + 8 }}>
        <View className="flex-row items-center px-5 mb-4">
          <IconButton
            icon="chevron-back"
            variant="ghost"
            size="md"
            onPress={() => router.back()}
          />
          <Text className="text-[22px] font-inter-bold text-foreground ml-2">
            Preferences
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        
        {/* Appearance Section */}
        <View className="mb-6">
          <Text className="text-[16px] font-inter-bold text-foreground mb-2">
            Appearance
          </Text>
          <Text className="text-[14px] font-inter-medium text-foreground-muted mb-4">
            Choose light, dark, or system appearance
          </Text>
          
          <Card
            variant="default"
            padding="md"
            className="relative overflow-hidden"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 4,
              elevation: 2,
            }}>
            {/* Coming Soon Banner */}
            <View 
              className="absolute top-0 left-0 right-0 border-b py-2 px-4 z-10"
              style={{ 
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderBottomColor: 'rgba(245, 158, 11, 0.2)',
              }}>
              <View className="flex-row items-center">
                <Ionicons name="information-circle-outline" size={16} color="#F59E0B" />
                <Text className="text-[12px] font-inter-medium ml-2" style={{ color: '#F59E0B' }}>
                  Coming Soon
                </Text>
              </View>
            </View>
            
            <View className="flex-row justify-between mt-12 mb-4">
              {/* System Option */}
              <View className="flex-1 items-center mr-2">
                <View className="w-full aspect-[0.8] bg-background-secondary rounded-xl border border-border p-3 mb-2">
                  <View className="flex-row h-full">
                    {/* Light half */}
                    <View className="flex-1 bg-white rounded-l-lg p-2">
                      <View className="h-2 bg-foreground/10 rounded mb-2" />
                      <View className="h-2 bg-foreground/10 rounded mb-2 w-3/4" />
                      <View className="w-6 h-6 rounded-full bg-foreground/10" />
                    </View>
                    {/* Dark half */}
                    <View className="flex-1 bg-foreground rounded-r-lg p-2">
                      <View className="h-2 bg-white/20 rounded mb-2" />
                      <View className="h-2 bg-white/20 rounded mb-2 w-3/4" />
                      <View className="w-6 h-6 rounded-full bg-white/20" />
                    </View>
                  </View>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-[14px] font-inter-medium text-foreground mr-1">
                    System
                  </Text>
                  <Ionicons name="phone-portrait-outline" size={16} color="#6B7280" />
                </View>
              </View>

              {/* Light Option */}
              <View className="flex-1 items-center mx-1">
                <View className="w-full aspect-[0.8] bg-background-secondary rounded-xl border-2 border-foreground p-3 mb-2">
                  <View className="flex-1 bg-white rounded-lg p-2">
                    <View className="h-2 bg-foreground/10 rounded mb-2" />
                    <View className="h-2 bg-foreground/10 rounded mb-2 w-3/4" />
                    <View className="h-2 bg-foreground/10 rounded mb-2 w-1/2" />
                    <View className="w-6 h-6 rounded-full bg-foreground/10 mt-auto" />
                  </View>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-[14px] font-inter-medium text-foreground mr-1">
                    Light
                  </Text>
                  <Ionicons name="sunny-outline" size={16} color="#6B7280" />
                </View>
              </View>

              {/* Dark Option */}
              <View className="flex-1 items-center ml-2">
                <View className="w-full aspect-[0.8] bg-background-secondary rounded-xl border border-border p-3 mb-2">
                  <View className="flex-1 bg-foreground rounded-lg p-2">
                    <View className="h-2 bg-white/20 rounded mb-2" />
                    <View className="h-2 bg-white/20 rounded mb-2 w-3/4" />
                    <View className="h-2 bg-white/20 rounded mb-2 w-1/2" />
                    <View className="w-6 h-6 rounded-full bg-white/20 mt-auto" />
                  </View>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-[14px] font-inter-medium text-foreground mr-1">
                    Dark
                  </Text>
                  <Ionicons name="moon-outline" size={16} color="#6B7280" />
                </View>
              </View>
            </View>
          </Card>
        </View>

        {/* Favorite Stores Section */}
        <View className="mb-6">
          <Text className="text-[16px] font-inter-bold text-foreground mb-2">
            Favorite Stores
          </Text>
          <Text className="text-[14px] font-inter-medium text-foreground-muted mb-4">
            Select which stores you want to see in your search results
          </Text>
          
          <Card
            variant="default"
            padding="none"
            className="overflow-hidden"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 4,
              elevation: 2,
            }}>
            {favoriteStores.map((store, index) => (
              <View
                key={store.id}
                className={`
                  flex-row items-center justify-between py-4 px-4
                  ${index !== favoriteStores.length - 1 ? 'border-b border-border-light' : ''}
                `}>
                <View className="flex-1 mr-4">
                  <Text className="text-[16px] font-inter-bold text-foreground mb-1">
                    {store.title}
                  </Text>
                  <Text className="text-[14px] font-inter-medium text-foreground-muted">
                    {store.description}
                  </Text>
                </View>
                <Switch
                  value={store.value}
                  onValueChange={store.onChange}
                  trackColor={{ false: '#E5E5EA', true: '#000000' }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#E5E5EA"
                  disabled={isLoading}
                />
              </View>
            ))}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
