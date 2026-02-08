import { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CategorySection } from './CategorySection';
import { FollowUpQuestion } from './SuggestedQuestions';
import type { Message } from '@/types';

/**
 * Shimmer / glint placeholder shown while waiting for AI summary or follow-up.
 */
function StreamingPlaceholder({ lines = 2, width = '80%' }: { lines?: number; width?: string }) {
  const pulse = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <Animated.View style={{ opacity: pulse }} className="px-4 py-3">
      {Array.from({ length: lines }).map((_, i) => (
        <View
          key={i}
          className="bg-gray-200 rounded-md mb-2"
          style={{ height: 12, width: i === lines - 1 ? '55%' : width }}
        />
      ))}
    </Animated.View>
  );
}

interface MessageBubbleProps {
  message: Message;
  onFollowUpAnswer?: (answer: string) => void;
  isLastAssistant?: boolean;
  isSearching?: boolean;
  onLinkClick?: () => void;
  onSaveProduct?: (productId: string) => Promise<boolean>;
}

/**
 * Renders a single message bubble. User messages are right-aligned,
 * assistant messages are left-aligned with categories and follow-up.
 */
export function MessageBubble({
  message,
  onFollowUpAnswer,
  isLastAssistant,
  isSearching,
  onLinkClick,
  onSaveProduct,
}: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <View className="flex-row justify-end px-4 mb-3">
        <View className="bg-foreground rounded-2xl rounded-br-sm px-4 py-3 max-w-[85%]">
          <Text className="text-[15px] text-white font-inter leading-snug">
            {message.content}
          </Text>
        </View>
      </View>
    );
  }

  // Assistant message
  const hasContent = message.content && message.content.length > 0;
  const hasCategories = message.categories && message.categories.length > 0;

  if (!hasContent && !hasCategories) {
    return null;
  }

  // Build a lookup of recommendations by category label
  const recsByCategory = new Map<string, { productTitle: string; reason: string }>();
  if (message.recommendations) {
    for (const rec of message.recommendations) {
      recsByCategory.set(rec.categoryLabel, {
        productTitle: rec.productTitle,
        reason: rec.reason,
      });
    }
  }

  // Detect whether this message is still being streamed (categories arrived but summary hasn't yet)
  const isStreaming = isLastAssistant && isSearching;
  const summaryPending = isStreaming && hasCategories && !hasContent;
  const followUpPending = isStreaming && hasCategories && !message.followUpQuestion;

  return (
    <View className="mb-3">
      {/* AI Avatar + Summary text */}
      {hasContent ? (
        <View className="flex-row items-start px-4 mb-3">
          <View className="w-7 h-7 rounded-full bg-background-secondary items-center justify-center mr-2 mt-0.5">
            <Ionicons name="sparkles" size={14} color="#6B7280" />
          </View>
          <View className="flex-1">
            <Text className="text-[15px] text-foreground font-inter leading-snug">
              {message.content}
            </Text>
          </View>
        </View>
      ) : summaryPending ? (
        /* Placeholder glint while waiting for AI overview text */
        <View className="flex-row items-start px-4 mb-3">
          <View className="w-7 h-7 rounded-full bg-background-secondary items-center justify-center mr-2 mt-0.5">
            <Ionicons name="sparkles" size={14} color="#6B7280" />
          </View>
          <View className="flex-1">
            <StreamingPlaceholder lines={2} width="90%" />
            <Text className="text-[11px] text-foreground-muted mt-0.5 ml-4">
              Preparing AI overview...
            </Text>
          </View>
        </View>
      ) : null}

      {/* Categories with product carousels */}
      {hasCategories && (
        <View className={hasContent || summaryPending ? 'mt-1' : 'mt-0'}>
          {message.categories!.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              recommendation={recsByCategory.get(category.label)}
              onLinkClick={onLinkClick}
              onSaveProduct={onSaveProduct}
            />
          ))}
        </View>
      )}

      {/* Follow-up question with tappable options (only on last assistant, not while searching) */}
      {isLastAssistant && !isSearching && message.followUpQuestion && message.followUpOptions && message.followUpOptions.length > 0 && onFollowUpAnswer ? (
        <View className="mt-2">
          <FollowUpQuestion
            question={message.followUpQuestion}
            options={message.followUpOptions}
            onSelect={onFollowUpAnswer}
          />
        </View>
      ) : followUpPending ? (
        /* Placeholder glint while waiting for follow-up question */
        <View className="mt-2 px-4">
          <StreamingPlaceholder lines={1} width="60%" />
          <View className="flex-row mt-1" style={{ gap: 8 }}>
            {[70, 50, 60].map((w, i) => (
              <View
                key={i}
                className="bg-gray-100 rounded-full border border-gray-200"
                style={{ height: 36, width: w }}
              />
            ))}
          </View>
          <Text className="text-[11px] text-foreground-muted mt-2">
            Generating follow-up question...
          </Text>
        </View>
      ) : null}
    </View>
  );
}
