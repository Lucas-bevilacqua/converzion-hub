import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const createOrUpdateProfile = async (user: User) => {
  console.log("Checking/creating profile for user:", user.id);
  
  const { data: existingProfile, error: checkError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (checkError) {
    console.error("Error checking profile:", checkError);
    throw checkError;
  }

  if (!existingProfile) {
    console.log("Profile not found, creating...");
    const { error: createError } = await supabase
      .from('profiles')
      .insert([
        {
          id: user.id,
          full_name: user.user_metadata.full_name,
        }
      ]);

    if (createError) {
      console.error("Error creating profile:", createError);
      throw createError;
    }
    
    console.log("Profile created successfully");
  }

  return existingProfile;
};