import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Create client with realtime enabled
export const supabase = url && anon
  ? createClient(url, anon, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

// Helper type for realtime subscription
export type RealtimeChannel = ReturnType<typeof supabase.channel>;

// Export for use in components
export default supabase;
