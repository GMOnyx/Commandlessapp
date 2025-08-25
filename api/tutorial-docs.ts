import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Minimal decode: pass-through Clerk JWT as user id using the same helper as bots.ts would (simplified here)
  const token = authHeader.split(' ')[1];
  let userId: string | null = null;
  try {
    const parts = token.split('.');
    userId = parts.length === 3 ? JSON.parse(Buffer.from(parts[1], 'base64').toString()).sub : token;
  } catch {
    userId = token;
  }
  if (!userId) return res.status(401).json({ error: 'Invalid token' });

  if (req.method === 'GET') {
    const { botId } = req.query;
    if (!botId) return res.status(400).json({ error: 'botId required' });
    const { data, error } = await supabase
      .from('tutorial_docs')
      .select('id,title,created_at')
      .eq('user_id', userId)
      .eq('bot_id', botId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ docs: data });
  }

  if (req.method === 'POST') {
    const { botId, title, content } = req.body || {};
    if (!botId || !title || !content) return res.status(400).json({ error: 'botId, title, and content are required' });
    const { error } = await supabase
      .from('tutorial_docs')
      .insert({ user_id: userId, bot_id: botId, title, content });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { id, botId } = req.query;
    if (!id || !botId) return res.status(400).json({ error: 'id and botId required' });
    const { error } = await supabase
      .from('tutorial_docs')
      .delete()
      .eq('id', id)
      .eq('bot_id', botId)
      .eq('user_id', userId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}


