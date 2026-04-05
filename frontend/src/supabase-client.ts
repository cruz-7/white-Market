import { createClient } from "@supabase/supabase-js";
import { config } from "./config";

// Create client with realtime enabled
export const supabase = config.supabase.url && config.supabase.anonKey
  ? createClient(config.supabase.url, config.supabase.anonKey, {
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
