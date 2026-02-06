import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { profileService } from '@/utils/supabase-service';
import { CountryPicker } from '@/components/onboarding/CountryPicker';
import { CategoryPicker } from '@/components/onboarding/CategoryPicker';
import { Button } from '@/components/ui/Button';

const TOTAL_STEPS = 3;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Acquisition source options
const acquisitionSources = [
  { id: 'word_of_mouth', label: 'Word of Mouth', icon: 'people-outline' },
  { id: 'app_store_search', label: 'App Store Search', icon: 'search-outline' },
  { id: 'web_search', label: 'Web Search', icon: 'globe-outline' },
  { id: 'app_store_ad', label: 'App Store Ad', icon: 'megaphone-outline' },
  { id: 'instagram', label: 'Instagram', icon: 'logo-instagram' },
  { id: 'youtube', label: 'YouTube', icon: 'logo-youtube' },
  { id: 'tiktok', label: 'TikTok', icon: 'musical-notes-outline' },
  { id: 'meta', label: 'Meta / Facebook', icon: 'logo-facebook' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
] as const;

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshProfile } = useAuth();

  // Step state
  const [currentStep, setCurrentStep] = useState(0);
  const translateX = useSharedValue(0);

  // Step 1: Country
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  // Step 2: Categories
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Step 3: Acquisition source
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  // Ref for the acquisition source ScrollView to auto-scroll when "Other" is selected
  const sourceScrollRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when "Other" is selected so the text input is visible
  useEffect(() => {
    if (selectedSource === 'other') {
      setTimeout(() => {
        sourceScrollRef.current?.scrollToEnd({ animated: true });
      }, 250);
    }
  }, [selectedSource]);

  // Animated style for horizontal sliding
  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const animateToStep = useCallback(
    (step: number) => {
      translateX.value = withTiming(-step * SCREEN_WIDTH, {
        duration: 350,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
      setCurrentStep(step);
    },
    [translateX]
  );

  const handleComplete = useCallback(async () => {
    if (!user?.id || isSaving) return;

    setIsSaving(true);
    try {
      await profileService.completeOnboarding(user.id, {
        country: selectedCountry,
        shoppingCategories: selectedCategories,
        acquisitionSource: selectedSource,
        acquisitionSourceOther:
          selectedSource === 'other' ? otherText.trim() || null : null,
      });

      await refreshProfile();

      // Navigate to home
      router.replace('/(app)/home');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      // Still navigate to home on error -- don't block the user
      router.replace('/(app)/home');
    } finally {
      setIsSaving(false);
    }
  }, [user, selectedCountry, selectedCategories, selectedSource, otherText, isSaving, refreshProfile]);

  const handleNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep < TOTAL_STEPS - 1) {
      animateToStep(currentStep + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, animateToStep, handleComplete]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep > 0) {
      animateToStep(currentStep - 1);
    }
  }, [currentStep, animateToStep]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep < TOTAL_STEPS - 1) {
      animateToStep(currentStep + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, animateToStep, handleComplete]);

  const handleSourceSelect = useCallback(
    (sourceId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (selectedSource === sourceId) {
        setSelectedSource(null);
      } else {
        setSelectedSource(sourceId);
      }
    },
    [selectedSource]
  );

  // Determine if continue button should say "Continue" or "Get Started"
  const continueLabel = currentStep === TOTAL_STEPS - 1 ? 'Get Started' : 'Continue';

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header with step indicator and back/skip */}
      <View className="px-5 pt-4 pb-2">
        {/* Top row: back button + step dots + skip */}
        <View className="flex-row items-center justify-between mb-2">
          {/* Back button */}
          <TouchableOpacity
            onPress={handleBack}
            disabled={currentStep === 0}
            className="w-10 h-10 items-center justify-center"
            style={{ opacity: currentStep === 0 ? 0 : 1 }}>
            <Ionicons name="chevron-back" size={24} color="#000000" />
          </TouchableOpacity>

          {/* Step indicator dots */}
          <View className="flex-row items-center" style={{ gap: 8 }}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                className={`rounded-full ${
                  i === currentStep
                    ? 'bg-foreground'
                    : i < currentStep
                      ? 'bg-foreground/30'
                      : 'bg-border'
                }`}
                style={{
                  width: i === currentStep ? 24 : 8,
                  height: 8,
                }}
              />
            ))}
          </View>

          {/* Skip button */}
          <TouchableOpacity
            onPress={handleSkip}
            className="h-10 items-center justify-center px-1">
            <Text className="text-[15px] font-inter-medium text-foreground-muted">
              Skip
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sliding step content */}
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            flex: 1,
            width: SCREEN_WIDTH * TOTAL_STEPS,
          },
          animatedContainerStyle,
        ]}>
        {/* Step 1: Country */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <View className="flex-1">
            {/* Title area */}
            <View className="px-6 pt-4 pb-4">
              <Text className="text-[28px] font-inter-bold text-foreground mb-2">
                Where are you{'\n'}shopping from?
              </Text>
              <Text className="text-[16px] font-inter text-foreground-muted leading-relaxed">
                This helps us find the best deals for your region
              </Text>
            </View>

            {/* Country picker */}
            <CountryPicker
              selectedCode={selectedCountry}
              onSelect={setSelectedCountry}
            />
          </View>
        </KeyboardAvoidingView>

        {/* Step 2: Shopping Categories */}
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <View className="flex-1">
            {/* Title area */}
            <View className="px-6 pt-4 pb-4">
              <Text className="text-[28px] font-inter-bold text-foreground mb-2">
                What are you into?
              </Text>
              <Text className="text-[16px] font-inter text-foreground-muted leading-relaxed">
                Select categories you shop for most
              </Text>
            </View>

            {/* Category picker */}
            <CategoryPicker
              selectedIds={selectedCategories}
              onToggle={setSelectedCategories}
            />
          </View>
        </View>

        {/* Step 3: Acquisition source */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={insets.top + 80}
          style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <View className="flex-1">
            {/* Title area */}
            <View className="px-6 pt-4 pb-4">
              <Text className="text-[28px] font-inter-bold text-foreground mb-2">
                One last thing...
              </Text>
              <Text className="text-[16px] font-inter text-foreground-muted leading-relaxed">
                How did you hear about Shop AI?
              </Text>
            </View>

            {/* Source options */}
            <ScrollView
              ref={sourceScrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
              keyboardShouldPersistTaps="handled">
              {acquisitionSources.map((source) => {
                const isSelected = selectedSource === source.id;
                return (
                  <TouchableOpacity
                    key={source.id}
                    activeOpacity={0.6}
                    onPress={() => handleSourceSelect(source.id)}
                    className={`
                      flex-row items-center py-3.5 px-4 rounded-xl mb-2 border
                      ${
                        isSelected
                          ? 'bg-foreground border-foreground'
                          : 'bg-background border-border'
                      }
                    `}
                    style={{
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: isSelected ? 0.08 : 0.03,
                      shadowRadius: 2,
                      elevation: isSelected ? 2 : 1,
                    }}>
                    <Ionicons
                      name={source.icon as any}
                      size={20}
                      color={isSelected ? '#FFFFFF' : '#6B7280'}
                      style={{ marginRight: 12 }}
                    />
                    <Text
                      className={`flex-1 text-[16px] font-inter-medium ${
                        isSelected ? 'text-white' : 'text-foreground'
                      }`}>
                      {source.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                );
              })}

              {/* Other text input */}
              {selectedSource === 'other' && (
                <Animated.View entering={FadeIn.duration(200)}>
                  <View className="mt-1 mx-1">
                    <TextInput
                      className="bg-background-secondary rounded-xl px-4 py-3.5 text-[16px] font-inter text-foreground border border-border"
                      placeholder="Tell us more..."
                      placeholderTextColor="#9CA3AF"
                      value={otherText}
                      onChangeText={setOtherText}
                      maxLength={100}
                      returnKeyType="done"
                    />
                  </View>
                </Animated.View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>

      {/* Bottom CTA */}
      <View
        className="px-5 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}>
        <Button
          title={continueLabel}
          variant="primary"
          size="lg"
          fullWidth
          onPress={handleNext}
          isLoading={isSaving}
          disabled={isSaving}
        />
      </View>
    </View>
  );
}
