import { View, StyleSheet, Dimensions } from 'react-native';
import { CameraView as ExpoCameraView, CameraType } from 'expo-camera';
import { forwardRef } from 'react';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VIEWFINDER_SIZE = SCREEN_WIDTH * 0.75;
const CORNER_SIZE = 40;
const CORNER_THICKNESS = 4;

interface CameraViewProps {
  facing: CameraType;
  zoom: number;
  enableTorch: boolean;
}

export const CameraView = forwardRef<ExpoCameraView, CameraViewProps>(
  ({ facing, zoom, enableTorch }, ref) => {
    return (
      <View className="flex-1 bg-camera-bg">
        <ExpoCameraView
          ref={ref}
          style={StyleSheet.absoluteFillObject}
          facing={facing}
          zoom={zoom}
          enableTorch={enableTorch}
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
