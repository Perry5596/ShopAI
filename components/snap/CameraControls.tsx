import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface CameraControlsProps {
  isFlashOn: boolean;
  onFlashToggle: () => void;
  onCapture: () => void;
  onGalleryOpen: () => void;
  isCapturing?: boolean;
}

export function CameraControls({
  isFlashOn,
  onFlashToggle,
  onCapture,
  onGalleryOpen,
  isCapturing = false,
}: CameraControlsProps) {
  const handleCapture = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onCapture();
  };

  return (
    <View className="flex-row items-center justify-between px-10 py-6">
      {/* Flash Toggle */}
      <TouchableOpacity
        onPress={onFlashToggle}
        activeOpacity={0.7}
        className="w-12 h-12 rounded-full bg-white/20 items-center justify-center">
        <Ionicons
          name={isFlashOn ? 'flash' : 'flash-off'}
          size={24}
          color="#FFFFFF"
        />
      </TouchableOpacity>

      {/* Capture Button */}
      <TouchableOpacity
        onPress={handleCapture}
        disabled={isCapturing}
        activeOpacity={0.9}
        className="w-20 h-20 rounded-full bg-white items-center justify-center"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 4,
        }}>
        <View
          className={`w-16 h-16 rounded-full border-4 border-black ${
            isCapturing ? 'bg-background-secondary' : 'bg-white'
          }`}
        />
      </TouchableOpacity>

      {/* Gallery Button */}
      <TouchableOpacity
        onPress={onGalleryOpen}
        activeOpacity={0.7}
        className="w-12 h-12 rounded-full bg-white/20 items-center justify-center">
        <Ionicons name="image-outline" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}
