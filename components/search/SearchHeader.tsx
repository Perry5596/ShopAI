import { View, Text, TouchableOpacity, Alert, Platform, ActionSheetIOS, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { CenteredModal } from '@/components/ui/Modal';

interface SearchHeaderProps {
  title?: string;
  conversationId?: string | null;
  isFavorite?: boolean;
  onDelete?: () => void;
  onToggleFavorite?: () => void;
  onRename?: (newTitle: string) => void;
}

/**
 * Header bar for the search screen with back button, title, and 3-dot menu.
 */
export function SearchHeader({
  title,
  conversationId,
  isFavorite,
  onDelete,
  onToggleFavorite,
  onRename,
}: SearchHeaderProps) {
  const insets = useSafeAreaInsets();
  const [isRenameVisible, setIsRenameVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleMenuPress = () => {
    if (!conversationId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const favoriteText = isFavorite ? 'Remove from Favorites' : 'Add to Favorites';

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Rename', favoriteText, 'Delete', 'Cancel'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 3,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            // Rename
            setRenameValue(title || '');
            setIsRenameVisible(true);
          } else if (buttonIndex === 1) {
            // Toggle favorite
            onToggleFavorite?.();
          } else if (buttonIndex === 2) {
            // Delete – confirm
            confirmDelete();
          }
        }
      );
    } else {
      Alert.alert('Options', '', [
        {
          text: 'Rename',
          onPress: () => {
            setRenameValue(title || '');
            setIsRenameVisible(true);
          },
        },
        {
          text: favoriteText,
          onPress: () => onToggleFavorite?.(),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDelete,
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete Search',
      'Are you sure you want to delete this search? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete?.();
            router.back();
          },
        },
      ]
    );
  };

  const handleSaveRename = () => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Title cannot be empty');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRename?.(trimmed);
    setIsRenameVisible(false);
  };

  return (
    <>
      <View
        className="bg-background border-b border-border-light"
        style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.7}
            className="w-9 h-9 rounded-full bg-background-secondary items-center justify-center">
            <Ionicons name="chevron-back" size={20} color="#000" />
          </TouchableOpacity>
          <View className="flex-1 mx-3">
            <Text className="text-[17px] font-inter-semibold text-foreground" numberOfLines={1}>
              {title || 'Search Products'}
            </Text>
          </View>
          {conversationId && (
            <TouchableOpacity
              onPress={handleMenuPress}
              activeOpacity={0.7}
              className="w-9 h-9 rounded-full bg-background-secondary items-center justify-center">
              <Ionicons name="ellipsis-vertical" size={18} color="#000" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Rename Modal */}
      <CenteredModal isVisible={isRenameVisible} onClose={() => setIsRenameVisible(false)}>
        <View className="p-6">
          <Text className="text-[20px] font-inter-semibold text-foreground mb-4">
            Rename Search
          </Text>
          <TextInput
            value={renameValue}
            onChangeText={setRenameValue}
            placeholder="Enter search title"
            placeholderTextColor="#9CA3AF"
            className="border border-border-light rounded-xl px-4 py-3 text-[16px] font-inter text-foreground bg-card mb-4"
            autoFocus
            multiline
            maxLength={200}
          />
          <View className="flex-row justify-end gap-3">
            <TouchableOpacity
              onPress={() => setIsRenameVisible(false)}
              className="px-6 py-3 rounded-xl">
              <Text className="text-[16px] font-inter-medium text-foreground-muted">
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveRename}
              className="px-6 py-3 rounded-xl bg-foreground">
              <Text className="text-[16px] font-inter-medium text-background">
                Save
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </CenteredModal>
    </>
  );
}
