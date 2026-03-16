import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rqrezpinuwfaxazukmka.supabase.co";
const supabaseKey = "sb_publishable_Wr9MbZDJqUX8SMmzBcmgNw_I0BLNe_e";

export const supabase = createClient(supabaseUrl, supabaseKey);