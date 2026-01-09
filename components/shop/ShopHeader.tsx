import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { IconButton } from '../ui/IconButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ShopHeaderProps {
  title?: string;
  onShare?: () => void;
  onMenu?: () => void;
  transparent?: boolean;
}

export function ShopHeader({
  title = 'Shop',
  onShare,
  onMenu,
  transparent = true,
}: ShopHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className={`absolute left-0 right-0 z-10 flex-row items-center justify-between px-4 ${
        transparent ? '' : 'bg-background'
      }`}
      style={{ top: insets.top }}>
      {/* Back Button */}
      <IconButton
        icon="chevron-back"
        variant="default"
        size="lg"
        onPress={() => router.back()}
        className="bg-background-secondary/80"
      />

      {/* Title (optional) */}
      {!transparent && (
        <Text className="text-[18px] font-semibold text-foreground">{title}</Text>
      )}

      {/* Right Actions */}
      <View className="flex-row items-center space-x-2">
        <IconButton
          icon="share-outline"
          variant="default"
          size="lg"
          onPress={onShare}
          className="bg-background-secondary/80"
        />
        <IconButton
          icon="ellipsis-horizontal"
          variant="default"
          size="lg"
          onPress={onMenu}
          className="bg-background-secondary/80 ml-2"
        />
      </View>
    </View>
  );
}
