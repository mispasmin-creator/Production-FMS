import { createClient } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://bliuwvkdtvxmteyzuzds.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_-YlHrBy4MBZpCnHCZl4sXg_u3buvMYp'

const DEFAULT_DISPATCH_URL = 'https://bfgdazpqeyvfxbvglstu.supabase.co'
const DEFAULT_DISPATCH_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmZ2RhenBxZXl2Znhidmdsc3R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNjkwMDcsImV4cCI6MjA4NTk0NTAwN30.__nHiPVvir6Ux8pF9JEVVASo6XYhlWZnMRRsqLS2dr8'

const DEFAULT_PURCHASE_URL = 'https://jcgmyvxcamstnhuwmemc.supabase.co'
const DEFAULT_PURCHASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ215dnhjYW1zdG5odXdtZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDgyODAsImV4cCI6MjA4NTU4NDI4MH0.wMKYEcXGOgrRwy7DKBlBz-a_mWhAuZaknG_iXYvKLLo'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const rawDispatchUrl = process.env.NEXT_PUBLIC_NEW_ORDER_TO_DISPATCH_SUPABASE_URL || DEFAULT_DISPATCH_URL
const dispatchUrl = rawDispatchUrl.replace(/\/rest\/v1\/?$/, '')
const dispatchAnonKey = process.env.NEXT_PUBLIC_NEW_ORDER_TO_DISPATCH_ANON_KEY || DEFAULT_DISPATCH_ANON_KEY

export const dispatchSupabase = createClient(dispatchUrl, dispatchAnonKey)

const rawPurchaseUrl = process.env.NEXT_PUBLIC_PURCHASE_FMS_SUPABASE_URL || DEFAULT_PURCHASE_URL
const purchaseUrl = rawPurchaseUrl.replace(/\/rest\/v1\/?$/, '')
const purchaseAnonKey = process.env.NEXT_PUBLIC_PURCHASE_FMS_ANON_KEY || DEFAULT_PURCHASE_ANON_KEY

export const purchaseSupabase = createClient(purchaseUrl, purchaseAnonKey)

const DEFAULT_INVENTORY_URL = 'https://ozrgaddkpixwvcyypqid.supabase.co'
const DEFAULT_INVENTORY_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96cmdhZGRrcGl4d3ZjeXlwcWlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NzQ1MDgsImV4cCI6MjA5NTM1MDUwOH0.Z4B9J0xIPHxYFQsmj7lO2ygEcPGg5jFKvEHQMbzFoPg'

const rawInventoryUrl = process.env.INVENTORY_SUPABASE_URL || process.env.NEXT_PUBLIC_INVENTORY_SUPABASE_URL || DEFAULT_INVENTORY_URL
const inventoryUrl = rawInventoryUrl.replace(/\/rest\/v1\/?$/, '')
const inventoryAnonKey = process.env.INVENTORY_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_INVENTORY_SUPABASE_ANON_KEY || DEFAULT_INVENTORY_ANON_KEY

export const inventorySupabase = createClient(inventoryUrl, inventoryAnonKey)

