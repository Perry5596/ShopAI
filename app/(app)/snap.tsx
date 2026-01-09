import { View, Text, Alert, Image, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView as ExpoCameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useState, useRef } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { CameraView, CameraControls, ZoomControls } from '@/components/snap';
import { useSnapStore } from '@/stores';
import { useAuth } from '@/contexts/AuthContext';

export default function SnapScreen() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<ExpoCameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [zoom, setZoom] = useState<0.5 | 1>(1);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);

  const { captureAndProcess } = useSnapStore();
  const { user, profile } = useAuth();

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

  const processImage = async (uri: string) => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to capture images.');
      return;
    }

    try {
      // Start capture and process - this creates the shop in processing state
      // and returns immediately, with background processing continuing
      await captureAndProcess(uri, user.id, profile);
      
      // Navigate back to home - the shop will appear in processing state
      router.back();
    } catch (error) {
      console.error('Failed to process image:', error);
      Alert.alert(
        'Error',
        'Failed to process image. Please try again.',
        [{ text: 'OK' }]
      );
      setIsCapturing(false);
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });
      
      if (photo?.uri) {
        // Immediately show the captured image (freeze the camera)
        setCapturedImageUri(photo.uri);
        await processImage(photo.uri);
      }
    } catch (error) {
      console.error('Failed to capture image:', error);
      Alert.alert('Error', 'Failed to capture image. Please try again.');
      setIsCapturing(false);
      setCapturedImageUri(null);
    }
  };

  const handleGalleryOpen = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setIsCapturing(true);
      setCapturedImageUri(result.assets[0].uri);
      await processImage(result.assets[0].uri);
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
      {/* Show captured image when processing, otherwise show live camera */}
      {capturedImageUri ? (
        <View className="flex-1">
          <Image
            source={{ uri: capturedImageUri }}
            className="flex-1"
            resizeMode="cover"
          />
          {/* Processing overlay */}
          <View className="absolute inset-0 bg-black/50 items-center justify-center">
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text className="text-white text-[18px] font-semibold mt-4">
              Processing...
            </Text>
            <Text className="text-white/70 text-[14px] mt-2">
              Finding the best deals for you
            </Text>
          </View>
        </View>
      ) : (
        <CameraView
          ref={cameraRef}
          facing="back"
          zoomLevel={zoom}
          enableTorch={isFlashOn}
        />
      )}

      {/* Top Controls - only show when not processing */}
      {!capturedImageUri && (
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
      )}

      {/* Bottom Controls - only show when not processing */}
      {!capturedImageUri && (
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
      )}
    </View>
  );
}
