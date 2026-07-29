import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials are missing. Please check your environment variables.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const dispatchUrl = (process.env.NEXT_PUBLIC_NEW_ORDER_TO_DISPATCH_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '')
const dispatchAnonKey = process.env.NEXT_PUBLIC_NEW_ORDER_TO_DISPATCH_ANON_KEY || ''

export const dispatchSupabase = createClient(dispatchUrl, dispatchAnonKey)

const purchaseUrl = (process.env.NEXT_PUBLIC_PURCHASE_FMS_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '')
const purchaseAnonKey = process.env.NEXT_PUBLIC_PURCHASE_FMS_ANON_KEY || ''

export const purchaseSupabase = createClient(purchaseUrl, purchaseAnonKey)
