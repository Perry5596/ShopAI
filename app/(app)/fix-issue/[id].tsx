import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useShopStore } from '@/stores';
import { useAuth } from '@/contexts/AuthContext';

export default function FixIssueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { getShopById, reprocessShop } = useShopStore();
  const { user } = useAuth();
  const shop = getShopById(id || '');

  const handleUpdate = async () => {
    if (!description.trim()) return;
    if (!id || !user?.id) {
      Alert.alert('Error', 'Unable to reprocess. Please try again.');
      return;
    }
    if (!shop) {
      Alert.alert('Error', 'Shop not found. Please go back and try again.');
      return;
    }

    setIsSubmitting(true);
    try {
      await reprocessShop(id, user.id, description.trim());
      // Navigate back to the shop detail screen - it will show processing state
      router.back();
    } catch (error) {
      console.error('Failed to reprocess shop:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to reprocess. Please try again.'
      );
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background">
      {/* Header */}
      <View
        className="flex-row items-center px-4 border-b border-border-light"
        style={{ paddingTop: insets.top + 8, paddingBottom: 12 }}>
        <IconButton
          icon="chevron-back"
          variant="ghost"
          size="md"
          onPress={() => router.back()}
        />
        <View className="flex-1 flex-row items-center justify-center mr-10">
          <Ionicons name="sparkles" size={20} color="#000000" />
          <Text className="text-[18px] font-semibold text-foreground ml-2">
            Fix result
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1 px-5 pt-6"
        keyboardShouldPersistTaps="handled">
        {/* Image Preview */}
        {shop?.imageUrl && (
          <View className="mb-6">
            <Text className="text-[14px] font-medium text-foreground mb-2">
              Original Image
            </Text>
            <View className="rounded-2xl overflow-hidden bg-background-secondary">
              <Image
                source={{ uri: shop.imageUrl }}
                className="w-full h-40"
                resizeMode="cover"
              />
            </View>
            {shop.title && shop.title !== 'Processing...' && (
              <Text className="text-[12px] text-foreground-muted mt-2">
                Currently identified as: {shop.title}
              </Text>
            )}
          </View>
        )}

        {/* Description Input */}
        <TextInput
          className="bg-background-secondary rounded-2xl p-4 text-[16px] text-foreground min-h-[120px]"
          placeholder="Describe what needs to be fixed"
          placeholderTextColor="#9CA3AF"
          multiline
          textAlignVertical="top"
          value={description}
          onChangeText={setDescription}
          autoFocus
        />

        {/* Example Hint */}
        <Card variant="default" padding="md" className="mt-6 bg-background-secondary">
          <Text className="text-[14px] text-foreground">
            <Text className="font-semibold">Example: </Text>
            <Text className="text-foreground-muted">
              The product is a different brand - I'm looking for Adidas, not Nike.
            </Text>
          </Text>
        </Card>

        {/* Additional hints */}
        <View className="mt-6">
          <Text className="text-[14px] font-medium text-foreground mb-3">
            You can tell us about:
          </Text>
          <View className="space-y-2">
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
              <Text className="text-[14px] text-foreground-muted ml-2">
                Specific brand or model you're looking for
              </Text>
            </View>
            <View className="flex-row items-center mt-2">
              <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
              <Text className="text-[14px] text-foreground-muted ml-2">
                Color or size preferences
              </Text>
            </View>
            <View className="flex-row items-center mt-2">
              <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
              <Text className="text-[14px] text-foreground-muted ml-2">
                Price range constraints
              </Text>
            </View>
            <View className="flex-row items-center mt-2">
              <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
              <Text className="text-[14px] text-foreground-muted ml-2">
                Any wrong identification
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Reanalyze Button */}
      <View
        className="px-5 border-t border-border-light"
        style={{ paddingTop: 16, paddingBottom: insets.bottom + 16 }}>
        <Button
          title="Reanalyze"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isSubmitting}
          disabled={!description.trim() || !shop}
          onPress={handleUpdate}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
