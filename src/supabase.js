import { createClient } from '@supabase/supabase-js'

// These will be environment variables in production
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Storage adapter that uses Supabase instead of localStorage
export const createSupabaseStorage = () => {
  if (!supabase) {
    console.warn('Supabase not configured, falling back to localStorage');
    return null;
  }

  return {
    async get(key, shared = false) {
      try {
        const { data, error } = await supabase
          .from('storage')
          .select('value')
          .eq('key', key)
          .eq('shared', shared)
          .single();
        
        if (error) throw error;
        return data ? { key, value: data.value, shared } : null;
      } catch (error) {
        console.error('Supabase get error:', error);
        return null;
      }
    },

    async set(key, value, shared = false) {
      try {
        const { data, error } = await supabase
          .from('storage')
          .upsert({ key, value, shared, updated_at: new Date() }, { onConflict: 'key,shared' })
          .select()
          .single();
        
        if (error) throw error;
        return data ? { key, value: data.value, shared } : null;
      } catch (error) {
        console.error('Supabase set error:', error);
        return null;
      }
    },

    async delete(key, shared = false) {
      try {
        const { error } = await supabase
          .from('storage')
          .delete()
          .eq('key', key)
          .eq('shared', shared);
        
        if (error) throw error;
        return { key, deleted: true, shared };
      } catch (error) {
        console.error('Supabase delete error:', error);
        return null;
      }
    },

    async list(prefix = '', shared = false) {
      try {
        const { data, error } = await supabase
          .from('storage')
          .select('key')
          .eq('shared', shared)
          .like('key', `${prefix}%`);
        
        if (error) throw error;
        return { keys: data.map(d => d.key), prefix, shared };
      } catch (error) {
        console.error('Supabase list error:', error);
        return null;
      }
    }
  };
};

// Upload a staff photo to Supabase Storage and return the public URL
export const uploadStaffPhoto = async (file) => {
  if (!supabase) throw new Error('Supabase not configured');
  const ext = file.name.split('.').pop();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from('staff-photos')
    .upload(filename, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('staff-photos').getPublicUrl(filename);
  return data.publicUrl;
};

// Make storage available globally (mimics the artifact storage API)
if (typeof window !== 'undefined') {
  window.storage = createSupabaseStorage() || {
    // Fallback to localStorage if Supabase not configured
    async get(key) {
      const value = localStorage.getItem(key);
      return value ? { key, value, shared: false } : null;
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      return { key, value, shared: false };
    },
    async delete(key) {
      localStorage.removeItem(key);
      return { key, deleted: true, shared: false };
    },
    async list(prefix = '') {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
      return { keys, prefix, shared: false };
    }
  };
}
