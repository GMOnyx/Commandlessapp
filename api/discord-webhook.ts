import { type VercelRequest, type VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    console.log('🔗 Discord webhook interaction received:', JSON.stringify(body, null, 2));

    // Handle Discord's PING challenge for webhook verification
    if (body.type === 1) {
      console.log('✅ Responding to Discord PING challenge');
      return res.status(200).json({ type: 1 }); // PONG response
    }

    // Handle Discord slash command interactions
    if (body.type === 2) {
      console.log('⚡ Discord slash command interaction received');
      
      const commandName = body.data?.name || 'unknown';
      console.log(`Command: ${commandName}`);
      
      // For now, respond with a simple acknowledgment
      return res.status(200).json({
        type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
        data: {
          content: `✅ Command \`/${commandName}\` received! Webhook endpoint is working correctly.`
        }
      });
    }

    // Handle Discord button/component interactions
    if (body.type === 3) {
      console.log('🔘 Discord component interaction received');
      
      return res.status(200).json({
        type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
        data: {
          content: "Component interaction received!"
        }
      });
    }

    // Handle other interaction types
    console.log(`❓ Unsupported Discord interaction type: ${body.type}`);
    return res.status(200).json({
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        content: "This interaction type is not yet supported."
      }
    });

  } catch (error) {
    console.error('Error in Discord webhook handler:', error);
    return res.status(500).json({ 
      error: 'Internal server error'
    });
  }
} 