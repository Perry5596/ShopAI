import { View, Text, TouchableOpacity, Platform, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CenteredModal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useState } from 'react';

// TODO: Replace with your actual App Store ID once the app is published
// You can find this ID in App Store Connect after publishing
const IOS_APP_STORE_ID = 'YOUR_APP_STORE_ID';

interface RatingModalProps {
  isVisible: boolean;
  onClose: () => void;
  userEmail?: string;
  userName?: string;
}

export function RatingModal({ isVisible, onClose, userEmail, userName }: RatingModalProps) {
  const [rating, setRating] = useState<number | null>(null);

  const handleStarPress = (starValue: number) => {
    setRating(starValue);
  };

  const handleSubmit = () => {
    if (rating === null) {
      Alert.alert('Please Rate', 'Please select a rating before submitting.');
      return;
    }

    // Close the modal first
    onClose();
    setRating(null);

    // Then show the appropriate message after a brief delay
    setTimeout(() => {
      if (rating >= 4) {
        // 4 or 5 stars - prompt to rate on app store
        promptAppStoreRating();
      } else {
        // 1-3 stars - ask for email feedback
        requestEmailFeedback();
      }
    }, 300);
  };

  const promptAppStoreRating = () => {
    Alert.alert(
      'Thank You!',
      "We'd really appreciate it if you could rate us on the App Store!",
      [
        {
          text: 'Maybe Later',
          style: 'cancel',
        },
        {
          text: 'Rate Us',
          onPress: async () => {
            await redirectToAppStore();
          },
        },
      ]
    );
  };

  const redirectToAppStore = async () => {
    try {
      let url: string;
      let fallbackUrl: string;
      
      if (Platform.OS === 'ios') {
        // iOS App Store - try itms-apps:// first (more reliable), fallback to https://
        if (IOS_APP_STORE_ID === 'YOUR_APP_STORE_ID') {
          Alert.alert(
            'App Not Published',
            'The app store ID needs to be configured. Please update IOS_APP_STORE_ID in RatingModal.tsx once the app is published.'
          );
          return;
        }
        url = `itms-apps://itunes.apple.com/app/id${IOS_APP_STORE_ID}?action=write-review`;
        fallbackUrl = `https://apps.apple.com/app/id${IOS_APP_STORE_ID}?action=write-review`;
      } else {
        // Android Play Store - try market:// first, fallback to https://
        const packageName = 'app.luminasoftware.shopai';
        url = `market://details?id=${packageName}`;
        fallbackUrl = `https://play.google.com/store/apps/details?id=${packageName}`;
      }

      // Try the primary URL scheme first
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        // Fallback to https URL
        const canOpenFallback = await Linking.canOpenURL(fallbackUrl);
        if (canOpenFallback) {
          await Linking.openURL(fallbackUrl);
        } else {
          Alert.alert(
            'Unable to Open',
            'Unable to open the app store. Please search for "Shop AI" in your app store to leave a review.'
          );
        }
      }
    } catch (error) {
      console.error('Error opening app store:', error);
      Alert.alert(
        'Error',
        'Unable to open the app store. Please try again later.'
      );
    }
  };

  const requestEmailFeedback = () => {
    Alert.alert(
      'We Value Your Feedback',
      "We'd love to hear your feedback! Would you like to send us an email with your suggestions?",
      [
        {
          text: 'Maybe Later',
          style: 'cancel',
        },
        {
          text: 'Send Feedback',
          onPress: async () => {
            const email = userEmail || 'user@example.com';
            const name = userName || 'User';
            const subject = encodeURIComponent('App Feedback - Shop AI');
            const body = encodeURIComponent(
              `Hi Shop AI Team,\n\nI'd like to share some feedback about the app:\n\n[Please share your thoughts, suggestions, or concerns here]\n\n---\nUser Information:\nName: ${name}\nEmail: ${email}\n\nThank you for listening!`
            );
            const mailtoUrl = `mailto:support@luminasoftware.app?subject=${subject}&body=${body}`;
            
            const canOpen = await Linking.canOpenURL(mailtoUrl);
            if (canOpen) {
              await Linking.openURL(mailtoUrl);
            } else {
              Alert.alert(
                'Error',
                'Unable to open email client. Please contact support@luminasoftware.app directly.'
              );
            }
          },
        },
      ]
    );
  };

  const handleClose = () => {
    setRating(null);
    onClose();
  };

  return (
    <CenteredModal isVisible={isVisible} onClose={handleClose}>
      <View className="px-5 pt-6 pb-4">
        {/* Title */}
        <Text className="text-[17px] font-inter-semibold text-foreground mb-1 text-center">
          How are you feeling about Shop AI?
        </Text>
        
        {/* Star Rating */}
        <View className="flex-row justify-center items-center my-6">
          {[1, 2, 3, 4, 5].map((starValue) => (
            <TouchableOpacity
              key={starValue}
              onPress={() => handleStarPress(starValue)}
              activeOpacity={0.7}
              className="mx-1.5">
              <Ionicons
                name={rating && starValue <= rating ? 'star' : 'star-outline'}
                size={40}
                color={rating && starValue <= rating ? '#FFD700' : '#D1D5DB'}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Rating Labels */}
        {rating && (
          <View className="items-center mb-4">
            <Text className="text-[15px] font-inter-medium text-foreground">
              {rating === 5 && 'Excellent!'}
              {rating === 4 && 'Great!'}
              {rating === 3 && 'Good'}
              {rating === 2 && 'Fair'}
              {rating === 1 && 'Poor'}
            </Text>
          </View>
        )}

        {/* Native-style buttons */}
        <View className="border-t border-border mt-2">
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={rating === null}
            className={`py-4 items-center border-b border-border ${
              rating === null ? 'opacity-40' : ''
            }`}>
            <Text
              className={`text-[17px] font-inter-medium ${
                rating === null
                  ? 'text-foreground-muted'
                  : 'text-accent'
              }`}>
              Submit
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleClose}
            className="py-4 items-center">
            <Text className="text-[17px] font-inter-medium text-foreground">
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </CenteredModal>
  );
}
