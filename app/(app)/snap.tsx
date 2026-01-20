import { View, Text, Alert, Image, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView as ExpoCameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useState, useRef, useCallback } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { CameraView, CameraControls, ZoomControls } from '@/components/snap';
import { useSnapStore } from '@/stores';
import { RateLimitError } from '@/utils/mock-ai-service';
import { useAuth } from '@/contexts/AuthContext';

// Viewfinder constants (matching CameraView)
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT  } = Dimensions.get('window');
const VIEWFINDER_SIZE = SCREEN_WIDTH * 0.75;
const CORNER_SIZE = 40;
const CORNER_THICKNESS = 4;

// Testing mode for app store screenshots
// Set to true to display a static image instead of the camera
const TESTING_MODE = false;
// Path to the test image (can be a local require or a URI)
// Example: require('@/assets/splash.png') or 'https://example.com/image.jpg'
const TEST_IMAGE = require('@/assets/test-image.png');

export default function SnapScreen() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<ExpoCameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<0.5 | 1>(1); // Button-selected zoom (0.5x or 1x)
  const [continuousZoom, setContinuousZoom] = useState(0); // 0-1 for pinch-to-zoom
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);

  const { captureAndProcess } = useSnapStore();
  const { user, profile, isAuthenticated, isGuest, getIdentity } = useAuth();

  // Handler for pinch-to-zoom
  const handlePinchZoom = useCallback((newZoom: number) => {
    setContinuousZoom(Math.max(0, Math.min(1, newZoom)));
  }, []);

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
          title="Continue"
          variant="secondary"
          onPress={requestPermission}
          className="bg-white"
        />
      </View>
    );
  }

  const formatTimeRemaining = (resetsAt: string): string => {
    const now = new Date();
    const resetDate = new Date(resetsAt);
    const diffMs = resetDate.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'soon';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    const remainingHours = diffHours % 24;
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} and ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
    }
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
  };

  const processImage = async (uri: string) => {
    try {
      // Get current identity (user or anonymous)
      let identity;
      try {
        identity = await getIdentity();
      } catch (identityError) {
        // No identity available - should not happen if user got to snap screen
        Alert.alert(
          'Sign In Required',
          'Please sign in or continue as guest to scan products.',
          [{ text: 'OK', onPress: () => router.replace('/') }]
        );
        setIsCapturing(false);
        setCapturedImageUri(null);
        return;
      }

      // Start capture and process
      // For authenticated users, this creates a shop in the database
      // For guests, the rate limit is checked server-side
      await captureAndProcess(uri, identity, profile);
      
      // Navigate based on user type
      if (isGuest) {
        // Guests go to the results screen (results stored locally in snapStore)
        router.replace('/(app)/guest-results');
      } else {
        // Authenticated users go back to home (shop is in database)
        router.back();
      }
    } catch (err: unknown) {
      console.error('Failed to process image:', err);

      // Handle rate limit error with specific messaging
      if (err instanceof RateLimitError) {
        const rateLimitErr = err as RateLimitError;
        const timeRemaining = rateLimitErr.resetAt 
          ? formatTimeRemaining(rateLimitErr.resetAt) 
          : 'next week';
        
        const message = rateLimitErr.isGuest
          ? `You've used all ${rateLimitErr.limit} free scans. Sign in for more scans, or your limit will reset in ${timeRemaining}.`
          : `You've used all ${rateLimitErr.limit} scans for this week. Your limit will reset in ${timeRemaining}.`;
        
        // Reset state first
        setIsCapturing(false);
        setCapturedImageUri(null);
        
        const alertButtons = [
          { text: 'OK', onPress: () => {
            // Navigate back to home (use back() to avoid double navigation)
            router.back();
          }},
        ];
        
        if (rateLimitErr.isGuest) {
          alertButtons.push({ text: 'Sign In', onPress: () => {
            // First go back to home, then navigate to sign-in after a brief delay
            router.back();
            setTimeout(() => {
              router.push('/?showSignIn=true');
            }, 100);
          }});
        }
        
        Alert.alert('Scan Limit Reached', message, alertButtons);
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to process image. Please try again.';
      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
      setIsCapturing(false);
      setCapturedImageUri(null);
    }
  };

  const handleCapture = async () => {
    if (TESTING_MODE || !cameraRef.current || isCapturing) return;

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
    setZoomLevel(newZoom);
    // Reset continuous zoom when switching between 0.5x and 1x
    setContinuousZoom(0);
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
      {/* Show captured image when processing, otherwise show live camera or test image */}
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
      ) : TESTING_MODE ? (
        <View className="flex-1 bg-camera-bg" style={{ overflow: 'hidden' }}>
          <Image
            source={TEST_IMAGE}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: SCREEN_WIDTH,
              height: SCREEN_HEIGHT,
            }}
            resizeMode="cover"
          />
          {/* Viewfinder Overlay - same as CameraView */}
          <View className="flex-1 items-center justify-center">
            <View
              style={{
                width: VIEWFINDER_SIZE,
                height: VIEWFINDER_SIZE,
                position: 'relative',
              }}>
              {/* Top Left Corner */}
              <View style={[testStyles.corner, testStyles.topLeft]}>
                <View style={[testStyles.horizontalLine, { top: 0, left: 0 }]} />
                <View style={[testStyles.verticalLine, { top: 0, left: 0 }]} />
              </View>
              {/* Top Right Corner */}
              <View style={[testStyles.corner, testStyles.topRight]}>
                <View style={[testStyles.horizontalLine, { top: 0, right: 0 }]} />
                <View style={[testStyles.verticalLine, { top: 0, right: 0 }]} />
              </View>
              {/* Bottom Left Corner */}
              <View style={[testStyles.corner, testStyles.bottomLeft]}>
                <View style={[testStyles.horizontalLine, { bottom: 0, left: 0 }]} />
                <View style={[testStyles.verticalLine, { bottom: 0, left: 0 }]} />
              </View>
              {/* Bottom Right Corner */}
              <View style={[testStyles.corner, testStyles.bottomRight]}>
                <View style={[testStyles.horizontalLine, { bottom: 0, right: 0 }]} />
                <View style={[testStyles.verticalLine, { bottom: 0, right: 0 }]} />
              </View>
            </View>
          </View>
        </View>
      ) : (
        <CameraView
          ref={cameraRef}
          facing="back"
          zoomLevel={zoomLevel}
          continuousZoom={continuousZoom}
          enableTorch={isFlashOn}
          onPinchZoom={handlePinchZoom}
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
          <ZoomControls currentZoom={zoomLevel} onZoomChange={handleZoomChange} />

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

// Styles for testing mode viewfinder overlay (matching CameraView)
const testStyles = StyleSheet.create({
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  topLeft: {
    top: 0,
    left: 0,
  },
  topRight: {
    top: 0,
    right: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
  },
  horizontalLine: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_THICKNESS,
    backgroundColor: '#FFFFFF',
    borderRadius: CORNER_THICKNESS / 2,
  },
  verticalLine: {
    position: 'absolute',
    width: CORNER_THICKNESS,
    height: CORNER_SIZE,
    backgroundColor: '#FFFFFF',
    borderRadius: CORNER_THICKNESS / 2,
  },
});
