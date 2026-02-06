import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { countries, type Country } from '@/constants/countries';

interface CountryPickerProps {
  selectedCode: string | null;
  onSelect: (code: string | null) => void;
  /** Maximum height for the list (default: flex-1) */
  maxHeight?: number;
}

export function CountryPicker({ selectedCode, onSelect, maxHeight }: CountryPickerProps) {
  const [search, setSearch] = useState('');

  const filteredCountries = useMemo(() => {
    if (!search.trim()) return countries;
    const query = search.toLowerCase().trim();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.code.toLowerCase().includes(query)
    );
  }, [search]);

  const handleSelect = useCallback(
    (country: Country) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Toggle: if already selected, deselect
      if (selectedCode === country.code) {
        onSelect(null);
      } else {
        onSelect(country.code);
      }
      Keyboard.dismiss();
    },
    [selectedCode, onSelect]
  );

  const renderCountry = useCallback(
    ({ item }: { item: Country }) => {
      const isSelected = selectedCode === item.code;
      return (
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => handleSelect(item)}
          className={`
            flex-row items-center py-3.5 px-4 mx-4 rounded-xl mb-1
            ${isSelected ? 'bg-foreground' : ''}
          `}>
          <Text className="text-[20px] mr-3">{item.flag}</Text>
          <Text
            className={`flex-1 text-[16px] font-inter-medium ${
              isSelected ? 'text-white' : 'text-foreground'
            }`}>
            {item.name}
          </Text>
          {isSelected && (
            <Ionicons name="checkmark" size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      );
    },
    [selectedCode, handleSelect]
  );

  const keyExtractor = useCallback((item: Country) => item.code, []);

  return (
    <View className="flex-1">
      {/* Search Input */}
      <View className="mx-4 mb-3">
        <View className="flex-row items-center bg-background-secondary rounded-xl px-4 py-3">
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            className="flex-1 ml-3 text-[16px] font-inter text-foreground"
            placeholder="Search countries..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Country List */}
      <FlatList
        data={filteredCountries}
        renderItem={renderCountry}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={maxHeight ? { maxHeight } : { flex: 1 }}
        contentContainerStyle={{ paddingBottom: 16 }}
        ListEmptyComponent={
          <View className="items-center py-8">
            <Text className="text-[16px] font-inter-medium text-foreground-muted">
              No countries found
            </Text>
          </View>
        }
      />
    </View>
  );
}
