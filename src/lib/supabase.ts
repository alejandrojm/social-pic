import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Event = {
  id: string
  name: string
  date: string
  admin_pin: string
  extra_pins: string[]
  description: string | null
  status: 'active' | 'paused' | 'ended'
  cover_url: string | null
  created_at: string
}

export type Photo = {
  id: string
  event_id: string
  url: string
  thumbnail_url: string | null
  uploader_name: string
  caption: string | null
  status: 'pending' | 'approved' | 'rejected'
  likes_count: number
  created_at: string
}

export type Like = {
  id: string
  photo_id: string
  session_id: string
  created_at: string
}
