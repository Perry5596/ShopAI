import { View, Text, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView as ExpoCameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useState, useRef } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { CameraView, CameraControls, ZoomControls } from '@/components/snap';

export default function SnapScreen() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<ExpoCameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [zoom, setZoom] = useState<0.5 | 1>(1);
  const [isCapturing, setIsCapturing] = useState(false);

  // Handle permissions
  if (!permission) {
    return (
      <View className="flex-1 bg-camera-bg items-center justify-center">
        <Text className="text-white">Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-camera-bg items-center justify-center px-8">
        <Text className="text-white text-[18px] font-semibold text-center mb-4">
          Camera Access Required
        </Text>
        <Text className="text-white/70 text-[14px] text-center mb-8">
          Shop AI needs camera access to scan products and find the best deals for you.
        </Text>
        <Button
          title="Grant Permission"
          variant="primary"
          onPress={requestPermission}
          className="bg-white"
        />
        <Button
          title="Go Back"
          variant="ghost"
          onPress={() => router.back()}
          className="mt-4"
        />
      </View>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      
      // Navigate to shop screen with the captured image
      // In a real app, you'd upload the image and get results
      router.push('/(app)/shop/new');
    } catch (error) {
      Alert.alert('Error', 'Failed to capture image. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleGalleryOpen = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      // Navigate to shop screen with the selected image
      router.push('/(app)/shop/new');
    }
  };

  const handleFlashToggle = () => {
    setIsFlashOn(!isFlashOn);
  };

  const handleZoomChange = (newZoom: 0.5 | 1) => {
    setZoom(newZoom);
  };

  const handleHelp = () => {
    Alert.alert(
      'How to use',
      'Position the item you want to find in the center of the frame and tap the capture button. Shop AI will find similar products and the best deals for you.',
      [{ text: 'Got it' }]
    );
  };

  return (
    <View className="flex-1 bg-camera-bg">
      {/* Camera View */}
      <CameraView
        ref={cameraRef}
        facing="back"
        zoom={zoom === 0.5 ? 0 : 0}
        enableTorch={isFlashOn}
      />

      {/* Top Controls */}
      <View
        className="absolute left-0 right-0 flex-row items-center justify-between px-4"
        style={{ top: insets.top + 8 }}>
        {/* Close Button */}
        <IconButton
          icon="close"
          variant="ghost"
          size="lg"
          iconColor="#FFFFFF"
          onPress={() => router.back()}
          className="bg-black/30"
        />

        {/* Help Button */}
        <IconButton
          icon="help-circle-outline"
          variant="ghost"
          size="lg"
          iconColor="#FFFFFF"
          onPress={handleHelp}
          className="bg-black/30"
        />
      </View>

      {/* Bottom Controls */}
      <View
        className="absolute left-0 right-0"
        style={{ bottom: insets.bottom + 16 }}>
        {/* Zoom Controls */}
        <ZoomControls currentZoom={zoom} onZoomChange={handleZoomChange} />

        {/* Camera Controls */}
        <CameraControls
          isFlashOn={isFlashOn}
          onFlashToggle={handleFlashToggle}
          onCapture={handleCapture}
          onGalleryOpen={handleGalleryOpen}
          isCapturing={isCapturing}
        />
      </View>
    </View>
  );
}
