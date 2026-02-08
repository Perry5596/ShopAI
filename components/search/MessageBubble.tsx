import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CategorySection } from './CategorySection';
import { FollowUpQuestion } from './SuggestedQuestions';
import type { Message } from '@/types';

interface MessageBubbleProps {
  message: Message;
  onFollowUpAnswer?: (answer: string) => void;
  isLastAssistant?: boolean;
  isSearching?: boolean;
  onLinkClick?: () => void;
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

  return (
    <View className="mb-3">
      {/* AI Avatar + Summary text */}
      {hasContent && (
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
      )}

      {/* Categories with product carousels */}
      {hasCategories && (
        <View className={hasContent ? 'mt-1' : 'mt-0'}>
          {message.categories!.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              recommendation={recsByCategory.get(category.label)}
              onLinkClick={onLinkClick}
            />
          ))}
        </View>
      )}

      {/* Follow-up question with tappable options (only on last assistant, not while searching) */}
      {isLastAssistant && !isSearching && message.followUpQuestion && message.followUpOptions && message.followUpOptions.length > 0 && onFollowUpAnswer && (
        <View className="mt-2">
          <FollowUpQuestion
            question={message.followUpQuestion}
            options={message.followUpOptions}
            onSelect={onFollowUpAnswer}
          />
        </View>
      )}
    </View>
  );
}
