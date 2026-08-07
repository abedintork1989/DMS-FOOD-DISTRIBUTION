import { createClient } from "@supabase/supabase-js";


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;



if (!supabaseUrl) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL در فایل .env.local پیدا نشد"
  );
}


if (!supabaseAnonKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY در فایل .env.local پیدا نشد"
  );
}



export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);