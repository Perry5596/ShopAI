import { View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';

interface ZoomControlsProps {
  currentZoom: 0.5 | 1;
  onZoomChange: (zoom: 0.5 | 1) => void;
}

export function ZoomControls({ currentZoom, onZoomChange }: ZoomControlsProps) {
  const handleZoomChange = (zoom: 0.5 | 1) => {
    if (zoom !== currentZoom) {
      Haptics.selectionAsync();
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
