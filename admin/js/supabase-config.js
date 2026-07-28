// Supabase Configuration for Admin
const SUPABASE_URL = 'https://hxfivwycxvjifrznqpqy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4Zml2d3ljeHZqaWZyem5xcHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNTIzMDYsImV4cCI6MjEwMDgyODMwNn0.eYUsyopbxij-ETe3wNa001A1K3fiMIwIUjI-oE-4YcU';

// Create Supabase client - the CDN exposes window.supabase with createClient
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
