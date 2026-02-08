import { ScrollView, TouchableOpacity, Text } from 'react-native';
import * as Haptics from 'expo-haptics';

interface SuggestedQuestionsProps {
  questions: string[];
  onSelect: (question: string) => void;
  disabled?: boolean;
}

/**
 * Horizontal scroll of tappable pill/chip buttons for follow-up questions.
 */
export function SuggestedQuestions({ questions, onSelect, disabled }: SuggestedQuestionsProps) {
  if (questions.length === 0) return null;

  const handlePress = (question: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(question);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
      className="mb-1">
      {questions.map((question, index) => (
        <TouchableOpacity
          key={index}
          onPress={() => handlePress(question)}
          disabled={disabled}
          activeOpacity={0.7}
          className={`mr-2 px-4 py-2.5 rounded-full border border-border ${
            disabled ? 'opacity-50' : ''
          }`}
          style={{ backgroundColor: '#FAFAFA' }}>
          <Text className="text-[14px] text-foreground font-inter-medium">
            {question}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
