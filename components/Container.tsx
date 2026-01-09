import { ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ContainerProps extends ViewProps {
  children: React.ReactNode;
  padded?: boolean;
}

export function Container({ children, padded = true, className, ...props }: ContainerProps) {
  return (
    <SafeAreaView
      className={`flex-1 bg-background ${padded ? 'px-5' : ''} ${className || ''}`}
      {...props}>
      {children}
    </SafeAreaView>
  );
}
