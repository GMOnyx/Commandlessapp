import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function handler(req, res) {
  try {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    const url = req.url || '/';
    
    // Try to find the built files
    const possiblePaths = [
      path.resolve(__dirname, '..', 'dist', 'public'),
      path.resolve(__dirname, '..', 'client', 'dist'),
      path.resolve(__dirname, '..', 'build'),
      path.resolve(process.cwd(), 'dist', 'public'),
      path.resolve(process.cwd(), 'client', 'dist')
    ];
    
    let distPath = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        distPath = p;
        break;
      }
    }
    
    if (!distPath) {
      res.status(500).json({ 
        error: 'Build files not found',
        checked: possiblePaths,
        cwd: process.cwd(),
        __dirname 
      });
      return;
    }

    // Handle static assets
    if (url.startsWith('/assets/') || url.includes('.js') || url.includes('.css') || url.includes('.png')) {
      const filePath = path.join(distPath, url);
      
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath);
        const contentType = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon'
        }[ext] || 'application/octet-stream';
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        return res.end(fs.readFileSync(filePath));
      }
    }
    
    // Serve index.html for all other routes (SPA routing)
    const indexPath = path.join(distPath, 'index.html');
    
    if (fs.existsSync(indexPath)) {
      res.setHeader('Content-Type', 'text/html');
      res.end(fs.readFileSync(indexPath, 'utf8'));
    } else {
      res.status(404).json({ 
        error: 'index.html not found',
        distPath,
        indexPath,
        files: fs.readdirSync(distPath).slice(0, 10)
      });
    }
    
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: error.stack
    });
  }
} 