import { View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/contexts/AuthContext';
import { profileService, storageService } from '@/utils/supabase-service';
import { useProfileStore } from '@/stores';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, user, refreshProfile } = useAuth();
  const { updateProfile } = useProfileStore();
  
  const [name, setName] = useState(profile?.name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handlePickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant photo library access to change your profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0] && user?.id) {
        setIsUploadingAvatar(true);
        try {
          const uploadedUrl = await storageService.uploadProfileAvatar(user.id, result.assets[0].uri);
          setAvatarUrl(uploadedUrl);
        } catch (error) {
          console.error('Failed to upload avatar:', error);
          Alert.alert('Error', 'Failed to upload profile picture. Please try again.');
        } finally {
          setIsUploadingAvatar(false);
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to open image picker. Please try again.');
    }
  };

  const handleSave = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User not found. Please try again.');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Error', 'Name is required.');
      return;
    }

    // Validate username (alphanumeric, underscore, hyphen, 3-20 chars)
    if (username && !/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
      Alert.alert('Error', 'Username must be 3-20 characters and contain only letters, numbers, underscores, or hyphens.');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile(user.id, {
        name: name.trim(),
        username: username.trim() || null,
        avatarUrl: avatarUrl || null,
      });
      
      // Refresh profile in auth context
      await refreshProfile();
      
      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Failed to update profile:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to update profile. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background-secondary">
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
          <Text className="text-[22px] font-inter-semibold text-foreground ml-2">
            Edit Profile
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled">
        
        {/* Profile Picture Section */}
        <View className="items-center mb-8 mt-4">
          <TouchableOpacity
            onPress={handlePickImage}
            disabled={isUploadingAvatar}
            activeOpacity={0.7}
            className="relative">
            {isUploadingAvatar ? (
              <View className="w-24 h-24 rounded-full bg-background-secondary items-center justify-center">
                <ActivityIndicator size="large" color="#000000" />
              </View>
            ) : (
              <Avatar imageUrl={avatarUrl} name={name} size="xl" />
            )}
            <View className="absolute bottom-0 right-0 w-8 h-8 bg-accent rounded-full items-center justify-center border-2 border-background-secondary">
              <Ionicons name="camera" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <Text className="text-[14px] font-inter text-foreground-muted mt-3">
            Tap to change profile picture
          </Text>
        </View>

        {/* Name Input */}
        <View className="mb-6">
          <Text className="text-[14px] font-inter-medium text-foreground mb-2">
            Name *
          </Text>
          <TextInput
            className="bg-card rounded-2xl p-4 text-[16px] text-foreground border border-border-light"
            placeholder="Enter your name"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        {/* Username Input */}
        <View className="mb-6">
          <Text className="text-[14px] font-inter-medium text-foreground mb-2">
            Username
          </Text>
          <TextInput
            className="bg-card rounded-2xl p-4 text-[16px] text-foreground border border-border-light"
            placeholder="Enter username"
            placeholderTextColor="#9CA3AF"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text className="text-[12px] font-inter text-foreground-muted mt-2">
            3-20 characters, letters, numbers, underscores, or hyphens
          </Text>
        </View>

        {/* Email (Read-only) */}
        <View className="mb-6">
          <Text className="text-[14px] font-inter-medium text-foreground-muted mb-2">
            Email
          </Text>
          <View className="bg-background-secondary rounded-2xl p-4 border border-border-light">
            <Text className="text-[16px] font-inter text-foreground-muted">
              {profile?.email || user?.email || 'N/A'}
            </Text>
            <Text className="text-[12px] font-inter text-foreground-subtle mt-1">
              Email cannot be changed (OAuth)
            </Text>
          </View>
        </View>

        {/* Save Button */}
        <Button
          title="Save Changes"
          variant="primary"
          size="lg"
          onPress={handleSave}
          isLoading={isSaving}
          disabled={isSaving || isUploadingAvatar}
          fullWidth
          className="mt-4"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
