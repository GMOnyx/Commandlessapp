import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to decode JWT and extract user ID
function decodeJWT(token: string): { userId: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { userId: token };
    }
    const payload = JSON.parse(atob(parts[1]));
    const userId = payload.sub || payload.user_id || payload.id;
    if (!userId) {
      return null;
    }
    return { userId };
  } catch (error) {
    return { userId: token };
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const decodedToken = decodeJWT(token);
  if (!decodedToken) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  const userId = decodedToken.userId;
  const { id } = req.query;

  console.log('🔍 Debug mapping request:', { userId, mappingId: id });

  try {
    // First try with just basic columns
    const { data: mapping, error } = await supabase
      .from('command_mappings')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    console.log('🔍 Debug mapping result:', {
      found: !!mapping,
      error: error?.message,
      errorCode: error?.code,
      columns: mapping ? Object.keys(mapping) : 'none'
    });

    if (error) {
      return res.status(404).json({ 
        error: 'Mapping not found', 
        details: error,
        userId: userId,
        mappingId: id
      });
    }

    return res.status(200).json({
      success: true,
      mapping: mapping,
      columns: Object.keys(mapping)
    });

  } catch (error) {
    console.error('Debug mapping error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
} 