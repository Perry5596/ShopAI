-- Migration: Add delete policy for profiles table
-- This allows users to delete their own profile

create policy "Users can delete own profile"
  on public.profiles for delete
  using (auth.uid() = id);
