import { View, Text, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/ui/IconButton';
import { ProfileCard, SettingsSection } from '@/components/profile';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import type { SettingsSection as SettingsSectionType } from '@/types';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut, deleteAccount } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEditProfile = () => {
    Alert.alert('Edit Profile', 'Profile editing would open here');
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This will permanently delete all your data including shops, products, and saved items. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Second confirmation for extra safety
            Alert.alert(
              'Final Confirmation',
              'Type DELETE to confirm account deletion.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Confirm Delete',
                  style: 'destructive',
                  onPress: async () => {
                    setIsDeleting(true);
                    try {
                      await deleteAccount();
                      router.replace('/');
                    } catch (error) {
                      console.error('Delete account error:', error);
                      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                      Alert.alert(
                        'Error',
                        `Failed to delete account: ${errorMessage}`
                      );
                    } finally {
                      setIsDeleting(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  // Generate username from email
  const username = profile?.email?.split('@')[0] || 'user';

  const settingsSections: SettingsSectionType[] = [
    {
      title: 'Account',
      items: [
        {
          id: 'personal-details',
          icon: 'person-outline',
          title: 'Personal Details',
          onPress: () => Alert.alert('Personal Details'),
        },
        {
          id: 'preferences',
          icon: 'settings-outline',
          title: 'Preferences',
          onPress: () => Alert.alert('Preferences'),
        },
        {
          id: 'language',
          icon: 'language-outline',
          title: 'Language',
          subtitle: 'English',
          onPress: () => Alert.alert('Language'),
        },
      ],
    },
    {
      title: 'Shopping',
      items: [
        {
          id: 'saved-items',
          icon: 'bookmark-outline',
          title: 'Saved Items',
          onPress: () => Alert.alert('Saved Items'),
        },
        {
          id: 'shopping-preferences',
          icon: 'bag-outline',
          title: 'Shopping Preferences',
          onPress: () => Alert.alert('Shopping Preferences'),
        },
      ],
    },
    {
      title: 'Support & Legal',
      items: [
        {
          id: 'request-feature',
          icon: 'bulb-outline',
          title: 'Request a Feature',
          onPress: () => Alert.alert('Request a Feature'),
        },
        {
          id: 'support-email',
          icon: 'mail-outline',
          title: 'Support Email',
          onPress: () => Alert.alert('Support Email'),
        },
        {
          id: 'terms',
          icon: 'document-text-outline',
          title: 'Terms and Conditions',
          onPress: () => Alert.alert('Terms and Conditions'),
        },
        {
          id: 'privacy',
          icon: 'shield-checkmark-outline',
          title: 'Privacy Policy',
          onPress: () => Alert.alert('Privacy Policy'),
        },
      ],
    },
    {
      title: 'Follow Us',
      items: [
        {
          id: 'instagram',
          icon: 'logo-instagram',
          title: 'Instagram',
          onPress: () => Alert.alert('Instagram'),
        },
        {
          id: 'tiktok',
          icon: 'logo-tiktok',
          title: 'TikTok',
          onPress: () => Alert.alert('TikTok'),
        },
      ],
    },
    {
      title: 'Account Actions',
      items: [
        {
          id: 'sync-data',
          icon: 'sync-outline',
          title: 'Sync Data',
          onPress: () => Alert.alert('Sync Data'),
        },
        {
          id: 'logout',
          icon: 'log-out-outline',
          title: 'Logout',
          onPress: handleLogout,
        },
        {
          id: 'delete-account',
          icon: 'trash-outline',
          title: isDeleting ? 'Deleting Account...' : 'Delete Account',
          isDestructive: true,
          onPress: isDeleting ? undefined : handleDeleteAccount,
        },
      ],
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
          <Text className="text-[22px] font-inter-semibold text-foreground ml-2">Profile</Text>
        </View>
      </View>

      {/* Settings Sections */}
      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* Profile Card - Now in its own section */}
        <ProfileCard
          name={profile?.name || 'User'}
          username={username}
          avatarUrl={profile?.avatarUrl}
          isPremium={profile?.isPremium || false}
          onPress={handleEditProfile}
        />
        
        <View className="h-6" />

        {settingsSections.map((section) => (
          <SettingsSection
            key={section.title}
            title={section.title}
            items={section.items}
          />
        ))}
      </ScrollView>
    </View>
  );
}
