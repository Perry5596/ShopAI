import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CategorySection } from './CategorySection';
import { SuggestedQuestions } from './SuggestedQuestions';
import type { Message } from '@/types';

interface MessageBubbleProps {
  message: Message;
  onSuggestedQuestion?: (question: string) => void;
  isLastAssistant?: boolean;
  isSearching?: boolean;
  onLinkClick?: () => void;
}

/**
 * Renders a single message bubble. User messages are right-aligned,
 * assistant messages are left-aligned with categories and suggestions.
 *
 * During streaming, the assistant message may initially have no content
 * but categories will appear progressively. The summary text arrives last.
 */
export function MessageBubble({
  message,
  onSuggestedQuestion,
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

  // Don't render anything if there's no content and no categories yet (still loading)
  if (!hasContent && !hasCategories) {
    return null;
  }

  return (
    <View className="mb-3">
      {/* AI Avatar + Text (only show when there's content) */}
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
              onLinkClick={onLinkClick}
            />
          ))}
        </View>
      )}

      {/* Suggested follow-up questions (only on last assistant message, and not while searching) */}
      {isLastAssistant && !isSearching && message.suggestedQuestions && message.suggestedQuestions.length > 0 && onSuggestedQuestion && (
        <View className="mt-2">
          <SuggestedQuestions
            questions={message.suggestedQuestions}
            onSelect={onSuggestedQuestion}
          />
        </View>
      )}
    </View>
  );
}
