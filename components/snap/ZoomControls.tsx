import { View, Text, TouchableOpacity, Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

interface ZoomControlsProps {
  currentZoom: 0.5 | 1;
  onZoomChange: (zoom: 0.5 | 1) => void;
}

export function ZoomControls({ currentZoom, onZoomChange }: ZoomControlsProps) {
  const handleZoomChange = (zoom: 0.5 | 1) => {
    if (zoom !== currentZoom) {
      Haptics.selectionAsync();
      
      // Note: 0.5x (ultra-wide) lens requires native camera module access
      // expo-camera doesn't support switching between camera lenses
      // In production, use react-native-vision-camera for this feature
      if (zoom === 0.5 && Platform.OS !== 'web') {
        // Still allow the UI toggle for visual feedback
        // In Expo Go, both will use the same lens
      }
      
      onZoomChange(zoom);
    }
  };

  return (
    <View className="flex-row items-center justify-center mb-4">
      <View className="flex-row bg-black/40 rounded-full p-1">
        <TouchableOpacity
          onPress={() => handleZoomChange(0.5)}
          activeOpacity={0.7}
          className={`px-4 py-2 rounded-full ${
            currentZoom === 0.5 ? 'bg-white/30' : ''
          }`}>
          <Text
            className={`text-[14px] font-semibold ${
              currentZoom === 0.5 ? 'text-white' : 'text-white/60'
            }`}>
            .5x
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleZoomChange(1)}
          activeOpacity={0.7}
          className={`px-4 py-2 rounded-full ${
            currentZoom === 1 ? 'bg-white/30' : ''
          }`}>
          <Text
            className={`text-[14px] font-semibold ${
              currentZoom === 1 ? 'text-white' : 'text-white/60'
            }`}>
            1x
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
