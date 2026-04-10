import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client-side Supabase client (public, for image URLs etc.)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side Supabase client (with service role for Storage uploads)
export function createServiceClient() {
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export function getMenuImageUrl(path: string): string {
  const { data } = supabase.storage.from('menu-images').getPublicUrl(path)
  return data.publicUrl
}
