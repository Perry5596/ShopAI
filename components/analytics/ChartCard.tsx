import { View } from 'react-native';
import type { ReactNode } from 'react';

interface ChartCardProps {
  children: ReactNode;
}

/**
 * Reusable white card wrapper for analytics chart sections.
 * Provides consistent rounded corners, padding, and shadow.
 */
export function ChartCard({ children }: ChartCardProps) {
  return (
    <View
      className="bg-card rounded-2xl p-4 mx-5 mb-4"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}>
      {children}
    </View>
  );
}
