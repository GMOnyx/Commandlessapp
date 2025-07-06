import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL or anonymous key is not defined');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getUserByUsername(username: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function getUser(userId: string) {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
}

async function createUser(userData: any) {
  const { data, error } = await supabase
    .from('users')
    .insert(userData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function createBot(botData: any) {
  const { data, error } = await supabase
    .from('bots')
    .insert(botData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getBots(userId: string) {
    const { data, error } = await supabase
        .from('bots')
        .select('*')
        .eq('user_id', userId);
    if (error) throw error;
    return data || [];
}

async function createCommandMapping(mappingData: any) {
  const { data, error } = await supabase
    .from('command_mappings')
    .insert(mappingData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getCommandMappings(userId: string) {
    const { data, error } = await supabase
        .from('command_mappings')
        .select('*')
        .eq('user_id', userId);
    if (error) throw error;
    return data || [];
}

async function getCommandMapping(mappingId: string) {
    const { data, error } = await supabase
        .from('command_mappings')
        .select('*')
        .eq('id', mappingId)
        .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
}

async function incrementCommandUsage(mappingId: string) {
    const { error } = await supabase.rpc('increment_usage_count', { mapping_id: mappingId });
    if (error) console.error('Error incrementing usage count:', error);
}


async function createActivity(activityData: any) {
  const { data, error } = await supabase
    .from('activities')
    .insert(activityData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function clearAllData() {
    await supabase.from('command_mappings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('bots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('activities').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

export const storage = {
  getUserByUsername,
  getUser,
  createUser,
  createBot,
  getBots,
  createCommandMapping,
  getCommandMappings,
  getCommandMapping,
  incrementCommandUsage,
  createActivity,
  clearAllData,
};
