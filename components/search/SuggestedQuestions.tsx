import { View, TouchableOpacity, Text } from 'react-native';
import * as Haptics from 'expo-haptics';

interface FollowUpProps {
  /** The single question the AI is asking */
  question: string;
  /** The answer options the user can tap */
  options: string[];
  /** Called when the user taps an option */
  onSelect: (answer: string) => void;
  disabled?: boolean;
}

/**
 * Displays a single AI follow-up question with tappable answer options.
 * Example: "How many people are you cooking for?" → [1-2] [3-5] [5+]
 */
export function FollowUpQuestion({ question, options, onSelect, disabled }: FollowUpProps) {
  if (!question || options.length === 0) return null;

  const handlePress = (option: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(option);
  };

  return (
    <View className="px-4 pb-3">
      {/* Question text */}
      <Text className="text-[14px] font-inter-medium text-foreground-muted mb-2.5">
        {question}
      </Text>

      {/* Answer options as horizontally wrapping chips */}
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {options.map((option, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => handlePress(option)}
            disabled={disabled}
            activeOpacity={0.7}
            className={`px-5 py-2.5 rounded-full border border-border ${
              disabled ? 'opacity-50' : ''
            }`}
            style={{ backgroundColor: '#FAFAFA' }}>
            <Text className="text-[14px] text-foreground font-inter-semibold">
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// Keep backward-compatible export name for existing imports
interface SuggestedQuestionsProps {
  questions: string[];
  onSelect: (question: string) => void;
  disabled?: boolean;
}

/**
 * @deprecated Use FollowUpQuestion instead. Kept for backward compat.
 */
export function SuggestedQuestions({ questions, onSelect, disabled }: SuggestedQuestionsProps) {
  if (questions.length === 0) return null;

  const handlePress = (question: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(question);
  };

  return (
    <View className="flex-row flex-wrap px-4 pb-3" style={{ gap: 8 }}>
      {questions.map((question, index) => (
        <TouchableOpacity
          key={index}
          onPress={() => handlePress(question)}
          disabled={disabled}
          activeOpacity={0.7}
          className={`px-4 py-2.5 rounded-full border border-border ${
            disabled ? 'opacity-50' : ''
          }`}
          style={{ backgroundColor: '#FAFAFA' }}>
          <Text className="text-[14px] text-foreground font-inter-medium">
            {question}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
