/**
 * Shopping categories for onboarding and preferences.
 * Aligned with Amazon's top-level category structure.
 * Each entry has an id, label, and Ionicons icon name.
 */

export interface ShoppingCategory {
  id: string;
  label: string;
  icon: string; // Ionicons name
}

export const shoppingCategories: ShoppingCategory[] = [
  { id: 'electronics', label: 'Electronics', icon: 'laptop-outline' },
  { id: 'clothing', label: 'Clothing & Fashion', icon: 'shirt-outline' },
  { id: 'home_kitchen', label: 'Home & Kitchen', icon: 'home-outline' },
  { id: 'beauty', label: 'Beauty & Personal Care', icon: 'sparkles-outline' },
  { id: 'sports', label: 'Sports & Outdoors', icon: 'football-outline' },
  { id: 'books', label: 'Books & Audible', icon: 'book-outline' },
  { id: 'health', label: 'Health & Household', icon: 'heart-outline' },
  { id: 'toys', label: 'Toys & Games', icon: 'game-controller-outline' },
  { id: 'automotive', label: 'Automotive', icon: 'car-outline' },
  { id: 'garden', label: 'Garden & Outdoor', icon: 'leaf-outline' },
  { id: 'pets', label: 'Pet Supplies', icon: 'paw-outline' },
  { id: 'baby', label: 'Baby', icon: 'happy-outline' },
  { id: 'tools', label: 'Tools & Home Improvement', icon: 'hammer-outline' },
  { id: 'grocery', label: 'Grocery & Gourmet', icon: 'cart-outline' },
  { id: 'office', label: 'Office & School Supplies', icon: 'briefcase-outline' },
];
