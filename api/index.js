import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, extname } from 'path';

export default function handler(req, res) {
  try {
    const url = req.url || '/';
    
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Try to find the built files in Vercel's environment
    const possiblePaths = [
      '/var/task/dist/public',
      '/var/task/client/dist', 
      './dist/public',
      './client/dist'
    ];
    
    let distPath = null;
    let availablePaths = [];
    
    for (const p of possiblePaths) {
      try {
        if (existsSync(p)) {
          distPath = p;
          break;
        }
        availablePaths.push(`${p}: ${existsSync(p) ? 'exists' : 'missing'}`);
      } catch (e) {
        availablePaths.push(`${p}: error - ${e.message}`);
      }
    }
    
    // If no build files found, show debug info
    if (!distPath) {
      return res.status(200).json({
        error: 'Build files not found',
        cwd: process.cwd(),
        checkedPaths: availablePaths,
        message: 'App needs to be built. Check Vercel build logs.'
      });
    }

    // Handle static assets (CSS, JS, images)
    if (url.includes('.') && (url.startsWith('/assets/') || url.endsWith('.js') || url.endsWith('.css') || url.endsWith('.png') || url.endsWith('.ico'))) {
      const filePath = join(distPath, url);
      
      if (existsSync(filePath)) {
        const ext = extname(filePath);
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
        return res.end(readFileSync(filePath));
      }
    }
    
    // Serve index.html for all other routes (SPA routing)
    const indexPath = join(distPath, 'index.html');
    
    if (existsSync(indexPath)) {
      res.setHeader('Content-Type', 'text/html');
      return res.end(readFileSync(indexPath, 'utf8'));
    } else {
      // Show what files are available for debugging
      const files = existsSync(distPath) ? readdirSync(distPath) : [];
      return res.status(200).json({
        error: 'index.html not found',
        distPath,
        indexPath,
        availableFiles: files.slice(0, 10),
        message: 'React app not built correctly'
      });
    }
    
  } catch (error) {
    return res.status(500).json({
      error: 'Server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 