import { useCallback, useRef } from 'react';
import { View, FlatList, Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchStore } from '@/stores/searchStore';
import { analyticsService } from '@/utils/supabase-service';
import { SearchHeader } from '@/components/search/SearchHeader';
import { ChatInput } from '@/components/search/ChatInput';
import { MessageBubble } from '@/components/search/MessageBubble';
import { TypingIndicator } from '@/components/search/TypingIndicator';
import { EmptySearch } from '@/components/search/EmptySearch';
import type { Message } from '@/types';

export default function SearchScreen() {
  const { getIdentity, session, isGuest } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const {
    activeConversation,
    isSearching,
    streamStatus,
    suggestedQuestions,
    error,
    startSearch,
    sendFollowUp,
    clearActiveConversation,
  } = useSearchStore();

  const messages = activeConversation?.messages || [];
  const conversationTitle = activeConversation?.title || undefined;

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = useCallback(
    async (query: string) => {
      try {
        const identity = await getIdentity();
        if (!identity) {
          Alert.alert('Error', 'Unable to authenticate. Please sign in and try again.');
          return;
        }

        if (activeConversation?.id) {
          // Follow-up in existing conversation
          await sendFollowUp(activeConversation.id, query, identity);
        } else {
          // Start new search
          await startSearch(query, identity);
        }

        scrollToBottom();
      } catch (err) {
        // Error is already set in the store
        console.error('Search error:', err);
      }
    },
    [activeConversation?.id, getIdentity, startSearch, sendFollowUp, scrollToBottom]
  );

  const handleSuggestedQuestion = useCallback(
    (question: string) => {
      handleSend(question);
    },
    [handleSend]
  );

  const handleLinkClick = useCallback(() => {
    if (session?.user?.id && !isGuest) {
      analyticsService.trackLinkClick(session.user.id);
    }
  }, [session?.user?.id, isGuest]);

  // Find the last assistant message index for suggested questions
  const lastAssistantIndex = messages.reduce(
    (last: number, msg: Message, idx: number) => (msg.role === 'assistant' ? idx : last),
    -1
  );

  const renderMessage = useCallback(
    ({ item, index }: { item: Message; index: number }) => (
      <MessageBubble
        message={item}
        onSuggestedQuestion={handleSuggestedQuestion}
        isLastAssistant={index === lastAssistantIndex}
        isSearching={isSearching}
        onLinkClick={handleLinkClick}
      />
    ),
    [handleSuggestedQuestion, lastAssistantIndex, isSearching, handleLinkClick]
  );

  // Determine whether to show the typing indicator:
  // Show while searching AND the streaming assistant message has no categories yet
  // (once categories start streaming in, the message bubble itself shows progress)
  const showTypingIndicator = isSearching && (() => {
    const streamingMsg = messages.find(
      (m) => m.id.startsWith('streaming-') || m.id.startsWith('streaming-followup-')
    );
    // Show if no streaming message yet, or if it has no categories yet
    return !streamingMsg || !streamingMsg.categories || streamingMsg.categories.length === 0;
  })();

  return (
    <View className="flex-1 bg-background">
      <SearchHeader title={conversationTitle} />

      {messages.length === 0 && !isSearching ? (
        <EmptySearch onSuggestionPress={handleSend} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 8 }}
          onContentSizeChange={scrollToBottom}
          ListFooterComponent={
            showTypingIndicator ? (
              <TypingIndicator statusText={streamStatus} />
            ) : null
          }
          // Extra data to force re-render when categories stream in
          extraData={[
            isSearching,
            streamStatus,
            messages.map((m) => `${m.id}-${m.categories?.length || 0}-${m.content?.length || 0}`).join(','),
          ]}
        />
      )}

      <ChatInput
        onSend={handleSend}
        disabled={isSearching}
        placeholder={
          messages.length > 0
            ? 'Ask a follow-up...'
            : 'Search for a product...'
        }
      />
    </View>
  );
}
