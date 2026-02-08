import { useCallback, useRef, useState } from 'react';
import { View, FlatList, Alert, TouchableOpacity, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchStore } from '@/stores/searchStore';
import { analyticsService, savedProductService } from '@/utils/supabase-service';
import { SearchHeader } from '@/components/search/SearchHeader';
import { ChatInput } from '@/components/search/ChatInput';
import { MessageBubble } from '@/components/search/MessageBubble';
import { TypingIndicator } from '@/components/search/TypingIndicator';
import { EmptySearch } from '@/components/search/EmptySearch';
import type { Message } from '@/types';

export default function SearchScreen() {
  const { getIdentity, session, isGuest } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  // Track whether the user just sent a message (to auto-scroll only on send)
  const justSentRef = useRef(false);

  const {
    activeConversation,
    isSearching,
    streamStatus,
    error,
    startSearch,
    sendFollowUp,
    clearActiveConversation,
  } = useSearchStore();

  const messages = activeConversation?.messages || [];
  const conversationTitle = activeConversation?.title || undefined;

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

        // Mark that user just sent a message — triggers auto-scroll
        justSentRef.current = true;
        scrollToBottom();

        if (activeConversation?.id) {
          await sendFollowUp(activeConversation.id, query, identity);
        } else {
          await startSearch(query, identity);
        }
      } catch (err) {
        console.error('Search error:', err);
      }
    },
    [activeConversation?.id, getIdentity, startSearch, sendFollowUp, scrollToBottom]
  );

  const handleFollowUpAnswer = useCallback(
    (answer: string) => {
      handleSend(answer);
    },
    [handleSend]
  );

  const handleLinkClick = useCallback(() => {
    if (session?.user?.id && !isGuest) {
      analyticsService.trackLinkClick(session.user.id);
    }
  }, [session?.user?.id, isGuest]);

  const handleSaveProduct = useCallback(async (productId: string): Promise<boolean> => {
    return savedProductService.toggleFavorite(productId);
  }, []);

  // Track scroll position to decide when to show the scroll-to-bottom button
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    // Show button if user is more than 300px from the bottom
    setShowScrollButton(distanceFromBottom > 300);
  }, []);

  // Only auto-scroll on content size change if the user just sent a message
  const handleContentSizeChange = useCallback(() => {
    if (justSentRef.current) {
      scrollToBottom();
      // Reset after a short delay to stop auto-scrolling once results start streaming
      setTimeout(() => {
        justSentRef.current = false;
      }, 500);
    }
  }, [scrollToBottom]);

  // Find the last assistant message index
  const lastAssistantIndex = messages.reduce(
    (last: number, msg: Message, idx: number) => (msg.role === 'assistant' ? idx : last),
    -1
  );

  const renderMessage = useCallback(
    ({ item, index }: { item: Message; index: number }) => (
      <MessageBubble
        message={item}
        onFollowUpAnswer={handleFollowUpAnswer}
        isLastAssistant={index === lastAssistantIndex}
        isSearching={isSearching}
        onLinkClick={handleLinkClick}
        onSaveProduct={handleSaveProduct}
      />
    ),
    [handleFollowUpAnswer, lastAssistantIndex, isSearching, handleLinkClick, handleSaveProduct]
  );

  // Show typing indicator while searching and before categories arrive
  const showTypingIndicator = isSearching && (() => {
    const streamingMsg = messages.find(
      (m) => m.id.startsWith('streaming-') || m.id.startsWith('streaming-followup-')
    );
    return !streamingMsg || !streamingMsg.categories || streamingMsg.categories.length === 0;
  })();

  return (
    <View className="flex-1 bg-background">
      <SearchHeader title={conversationTitle} />

      {messages.length === 0 && !isSearching ? (
        <EmptySearch onSuggestionPress={handleSend} />
      ) : (
        <View className="flex-1">
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 8 }}
            onContentSizeChange={handleContentSizeChange}
            onScroll={handleScroll}
            scrollEventThrottle={200}
            ListFooterComponent={
              showTypingIndicator ? (
                <TypingIndicator statusText={streamStatus} />
              ) : null
            }
            extraData={[
              isSearching,
              streamStatus,
              messages.map((m) => `${m.id}-${m.categories?.length || 0}-${m.content?.length || 0}`).join(','),
            ]}
          />

          {/* Scroll-to-bottom button */}
          {showScrollButton && (
            <TouchableOpacity
              onPress={scrollToBottom}
              activeOpacity={0.8}
              className="absolute bottom-3 right-4 w-10 h-10 bg-foreground rounded-full items-center justify-center"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 4,
              }}>
              <Ionicons name="chevron-down" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
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
