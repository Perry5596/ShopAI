import { View, Image, Text } from 'react-native';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  imageUrl?: string;
  name?: string;
  size?: AvatarSize;
  className?: string;
}

const sizeStyles: Record<AvatarSize, { container: string; text: string; imageSize: number }> = {
  sm: { container: 'w-8 h-8', text: 'text-[12px]', imageSize: 32 },
  md: { container: 'w-10 h-10', text: 'text-[14px]', imageSize: 40 },
  lg: { container: 'w-14 h-14', text: 'text-[18px]', imageSize: 56 },
  xl: { container: 'w-20 h-20', text: 'text-[24px]', imageSize: 80 },
};

export function Avatar({ imageUrl, name, size = 'md', className }: AvatarProps) {
  const sizeStyle = sizeStyles[size];
  
  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  if (imageUrl) {
    return (
      <View
        className={`
          rounded-full overflow-hidden bg-background-secondary
          ${sizeStyle.container}
          ${className || ''}
        `}>
        <Image
          source={{ uri: imageUrl }}
          style={{ width: sizeStyle.imageSize, height: sizeStyle.imageSize }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View
      className={`
        rounded-full items-center justify-center bg-background-tertiary
        ${sizeStyle.container}
        ${className || ''}
      `}>
      <Text className={`font-semibold text-foreground-muted ${sizeStyle.text}`}>
        {initials}
      </Text>
    </View>
  );
}
