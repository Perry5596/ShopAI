import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../ui/Button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ActionButtonsProps {
  shopId: string;
  onDone?: () => void;
}

export function ActionButtons({ shopId, onDone }: ActionButtonsProps) {
  const insets = useSafeAreaInsets();

  const handleFixIssue = () => {
    router.push(`/(app)/fix-issue/${shopId}`);
  };

  const handleDone = () => {
    if (onDone) {
      onDone();
    } else {
      router.back();
    }
  };

  return (
    <View
      className="absolute bottom-0 left-0 right-0 bg-background border-t border-border-light"
      style={{ paddingBottom: insets.bottom + 8 }}>
      <View className="flex-row px-5 pt-3 space-x-3">
        <Button
          title="Fix Issue"
          variant="secondary"
          size="lg"
          icon="sparkles"
          onPress={handleFixIssue}
          className="flex-1"
        />
        <Button
          title="Done"
          variant="primary"
          size="lg"
          onPress={handleDone}
          className="flex-1 ml-3"
        />
      </View>
      {/* Affiliate Disclaimer */}
      <Text className="text-[10px] font-inter text-foreground-subtle text-center px-5 pt-2 pb-1">
        Some links may be affiliate links. We may receive a commission at no extra cost to you.
      </Text>
    </View>
  );
}
