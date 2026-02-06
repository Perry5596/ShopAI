import { View, Text, ScrollView, Switch, Alert, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/ui/IconButton';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { profileService } from '@/utils/supabase-service';
import { CountryPicker } from '@/components/onboarding/CountryPicker';
import { CategoryPicker } from '@/components/onboarding/CategoryPicker';
import { getCountryByCode } from '@/constants/countries';
import { shoppingCategories } from '@/constants/shopping-categories';

interface PreferenceToggle {
  id: string;
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

  // State for onboarding preferences
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Modal visibility
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Load all preferences from profile
  useEffect(() => {
    if (profile) {
      setFavoriteAmazon(profile.favoriteAmazon ?? false);
      setFavoriteTarget(profile.favoriteTarget ?? false);
      setFavoriteBestBuy(profile.favoriteBestBuy ?? false);
      setFavoriteWalmart(profile.favoriteWalmart ?? false);
      setFavoriteEbay(profile.favoriteEbay ?? false);
      setSelectedCountry(profile.country ?? null);
      setSelectedCategories(profile.shoppingCategories ?? []);
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

  // Save country selection
  const handleCountrySave = useCallback(async (code: string | null) => {
    if (!user?.id) return;
    setSelectedCountry(code);
    setShowCountryModal(false);
    try {
      await profileService.updateOnboardingPreferences(user.id, { country: code });
      await refreshProfile();
    } catch (error) {
      console.error('Failed to update country:', error);
      Alert.alert('Error', 'Failed to update location. Please try again.');
      // Revert
      setSelectedCountry(profile?.country ?? null);
    }
  }, [user, profile, refreshProfile]);

  // Save category selection
  const handleCategoriesSave = useCallback(async () => {
    if (!user?.id) return;
    setShowCategoryModal(false);
    try {
      await profileService.updateOnboardingPreferences(user.id, {
        shoppingCategories: selectedCategories,
      });
      await refreshProfile();
    } catch (error) {
      console.error('Failed to update categories:', error);
      Alert.alert('Error', 'Failed to update shopping interests. Please try again.');
      // Revert
      setSelectedCategories(profile?.shoppingCategories ?? []);
    }
  }, [user, selectedCategories, profile, refreshProfile]);

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

  // Resolve country display
  const countryData = selectedCountry ? getCountryByCode(selectedCountry) : null;

  // Resolve selected category labels
  const selectedCategoryLabels = selectedCategories
    .map((id) => shoppingCategories.find((c) => c.id === id)?.label)
    .filter(Boolean);

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
        
        {/* Location Section */}
        <View className="mb-6">
          <Text className="text-[16px] font-inter-bold text-foreground mb-2">
            Location
          </Text>
          <Text className="text-[14px] font-inter-medium text-foreground-muted mb-4">
            Helps us find the best deals for your region
          </Text>
          
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowCountryModal(true);
            }}>
            <Card
              variant="default"
              padding="md"
              className="overflow-hidden"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
                elevation: 2,
              }}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  {countryData ? (
                    <>
                      <Text className="text-[22px] mr-3">{countryData.flag}</Text>
                      <Text className="text-[16px] font-inter-medium text-foreground">
                        {countryData.name}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="location-outline" size={22} color="#9CA3AF" style={{ marginRight: 12 }} />
                      <Text className="text-[16px] font-inter-medium text-foreground-muted">
                        Not set
                      </Text>
                    </>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>
            </Card>
          </TouchableOpacity>
        </View>

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

        {/* Shopping Interests Section */}
        <View className="mb-6">
          <Text className="text-[16px] font-inter-bold text-foreground mb-2">
            Shopping Interests
          </Text>
          <Text className="text-[14px] font-inter-medium text-foreground-muted mb-4">
            Categories that shape your shopping recommendations
          </Text>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowCategoryModal(true);
            }}>
            <Card
              variant="default"
              padding="md"
              className="overflow-hidden"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
                elevation: 2,
              }}>
              {selectedCategoryLabels.length > 0 ? (
                <View>
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {selectedCategoryLabels.map((label) => (
                      <View
                        key={label}
                        className="bg-background-secondary rounded-xl px-3 py-1.5">
                        <Text className="text-[14px] font-inter-medium text-foreground">
                          {label}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View className="flex-row items-center justify-end mt-3">
                    <Text className="text-[14px] font-inter-medium text-foreground-muted mr-1">
                      Edit
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                  </View>
                </View>
              ) : (
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <Ionicons name="pricetags-outline" size={22} color="#9CA3AF" style={{ marginRight: 12 }} />
                    <Text className="text-[16px] font-inter-medium text-foreground-muted">
                      None selected
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </View>
              )}
            </Card>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCountryModal(false)}>
        <View className="flex-1 bg-background" style={{ paddingTop: 8 }}>
          {/* Modal header */}
          <View className="flex-row items-center justify-between px-5 py-3 border-b border-border-light">
            <TouchableOpacity onPress={() => setShowCountryModal(false)}>
              <Text className="text-[16px] font-inter-medium text-foreground-muted">
                Cancel
              </Text>
            </TouchableOpacity>
            <Text className="text-[17px] font-inter-bold text-foreground">
              Location
            </Text>
            {selectedCountry ? (
              <TouchableOpacity onPress={() => handleCountrySave(null)}>
                <Text className="text-[16px] font-inter-medium text-destructive">
                  Clear
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 50 }} />
            )}
          </View>

          {/* Country picker */}
          <CountryPicker
            selectedCode={selectedCountry}
            onSelect={(code) => handleCountrySave(code)}
          />
        </View>
      </Modal>

      {/* Category Picker Modal */}
      <Modal
        visible={showCategoryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          handleCategoriesSave();
        }}>
        <View className="flex-1 bg-background" style={{ paddingTop: 8 }}>
          {/* Modal header */}
          <View className="flex-row items-center justify-between px-5 py-3 border-b border-border-light">
            <TouchableOpacity
              onPress={() => {
                // Revert changes if cancelled
                setSelectedCategories(profile?.shoppingCategories ?? []);
                setShowCategoryModal(false);
              }}>
              <Text className="text-[16px] font-inter-medium text-foreground-muted">
                Cancel
              </Text>
            </TouchableOpacity>
            <Text className="text-[17px] font-inter-bold text-foreground">
              Shopping Interests
            </Text>
            <TouchableOpacity onPress={handleCategoriesSave}>
              <Text className="text-[16px] font-inter-bold text-foreground">
                Done
              </Text>
            </TouchableOpacity>
          </View>

          {/* Category picker */}
          <View className="flex-1 pt-4">
            <CategoryPicker
              selectedIds={selectedCategories}
              onToggle={setSelectedCategories}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
