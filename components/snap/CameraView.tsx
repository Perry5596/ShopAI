import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { CameraView as ExpoCameraView, CameraType } from 'expo-camera';
import { forwardRef, useRef } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VIEWFINDER_SIZE = SCREEN_WIDTH * 0.75;
const CORNER_SIZE = 40;
const CORNER_THICKNESS = 4;

// Zoom constants
const MIN_ZOOM = 0;
const MAX_ZOOM = 1;

interface CameraViewProps {
  facing: CameraType;
  zoomLevel: 0.5 | 1; // Button-selected zoom level (0.5x = ultra-wide, 1x = wide)
  continuousZoom: number; // 0 to 1, for pinch-to-zoom (digital zoom on top of selected lens)
  enableTorch: boolean;
  onPinchZoom?: (zoom: number) => void;
}

export const CameraView = forwardRef<ExpoCameraView, CameraViewProps>(
  ({ facing, zoomLevel, continuousZoom, enableTorch, onPinchZoom }, ref) => {
    // Store the zoom value at the start of a pinch gesture
    const startZoomRef = useRef(continuousZoom);

    // Select the appropriate lens based on the button selection
    // On iOS, expo-camera supports lens prop: "ultra-wide", "wide", "telephoto"
    // 0.5x = ultra-wide lens, 1x = wide lens (standard)
    // Android doesn't fully support lens selection, so we fall back to zoom-based approach
    const selectedLens = zoomLevel === 0.5 ? 'ultra-wide' : 'wide';

    // For digital zoom via pinch gesture - starts at 0 (no digital zoom) for both lenses
    // The lens prop handles switching between physical cameras
    const effectiveZoom = Math.min(MAX_ZOOM, continuousZoom);

    // Create pinch gesture for zooming
    const pinchGesture = Gesture.Pinch()
      .onStart(() => {
        'worklet';
        startZoomRef.current = continuousZoom;
      })
      .onUpdate((event) => {
        'worklet';
        if (onPinchZoom) {
          // Calculate new zoom based on pinch scale
          // scale > 1 means pinching out (zoom in)
          // scale < 1 means pinching in (zoom out)
          const scaleDelta = event.scale - 1;
          const zoomDelta = scaleDelta * 0.5; // Sensitivity factor
          const newZoom = Math.min(
            MAX_ZOOM,
            Math.max(MIN_ZOOM, startZoomRef.current + zoomDelta)
          );
          runOnJS(onPinchZoom)(newZoom);
        }
      });

    return (
      <GestureDetector gesture={pinchGesture}>
        <View className="flex-1 bg-camera-bg">
          <ExpoCameraView
            ref={ref}
            style={StyleSheet.absoluteFillObject}
            facing={facing}
            zoom={effectiveZoom}
            enableTorch={enableTorch}
            // Use lens prop to select physical camera on iOS
            // "ultra-wide" = 0.5x, "wide" = 1x (standard)
            // Falls back gracefully on devices without ultra-wide lens
            {...(Platform.OS === 'ios' ? { lens: selectedLens } : {})}
          />

            {/* Viewfinder Overlay */}
            <View className="flex-1 items-center justify-center">
              <View
                style={{
                  width: VIEWFINDER_SIZE,
                  height: VIEWFINDER_SIZE,
                  position: 'relative',
                }}>
                {/* Top Left Corner */}
                <View style={[styles.corner, styles.topLeft]}>
                  <View style={[styles.horizontalLine, { top: 0, left: 0 }]} />
                  <View style={[styles.verticalLine, { top: 0, left: 0 }]} />
                </View>

                {/* Top Right Corner */}
                <View style={[styles.corner, styles.topRight]}>
                  <View style={[styles.horizontalLine, { top: 0, right: 0 }]} />
                  <View style={[styles.verticalLine, { top: 0, right: 0 }]} />
                </View>

                {/* Bottom Left Corner */}
                <View style={[styles.corner, styles.bottomLeft]}>
                  <View style={[styles.horizontalLine, { bottom: 0, left: 0 }]} />
                  <View style={[styles.verticalLine, { bottom: 0, left: 0 }]} />
                </View>

                {/* Bottom Right Corner */}
                <View style={[styles.corner, styles.bottomRight]}>
                  <View style={[styles.horizontalLine, { bottom: 0, right: 0 }]} />
                  <View style={[styles.verticalLine, { bottom: 0, right: 0 }]} />
                </View>
              </View>
            </View>
          </View>
        </GestureDetector>
    );
  }
);

CameraView.displayName = 'CameraView';

const styles = StyleSheet.create({
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
