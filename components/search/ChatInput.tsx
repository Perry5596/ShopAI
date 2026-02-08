import { useState, useRef } from 'react';
import { View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Fixed bottom chat input bar with send button.
 */
export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSend(trimmed);
    setText('');
  };

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}>
      <View
        className="border-t border-border bg-background px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <View className="flex-row items-end bg-background-secondary rounded-2xl px-4 py-2">
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder={placeholder || 'Search for a product...'}
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={500}
            editable={!disabled}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            className="flex-1 text-[16px] text-foreground font-inter py-1.5 max-h-24"
            style={{ lineHeight: 22 }}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            activeOpacity={0.7}
            className={`ml-2 w-9 h-9 rounded-full items-center justify-center mb-0.5 ${
              canSend ? 'bg-foreground' : 'bg-background-tertiary'
            }`}>
            <Ionicons
              name="arrow-up"
              size={20}
              color={canSend ? '#FFFFFF' : '#9CA3AF'}
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
