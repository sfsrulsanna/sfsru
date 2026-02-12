// js/supabase-config.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://qeewwoklmjysactfhrum.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlZXd3b2tsbWp5c2FjdGZocnVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MTI2MTEsImV4cCI6MjA4NjQ4ODYxMX0.gWzqku1cS08v17kfJHJbOWbm-DRpzwQ9omlQsKxc96A';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)