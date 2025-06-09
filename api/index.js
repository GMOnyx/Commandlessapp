import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function handler(req, res) {
  const distPath = path.resolve(__dirname, '..', 'dist', 'public');
  
  // Handle static files
  if (req.url.startsWith('/assets/') || req.url.includes('.')) {
    const filePath = path.join(distPath, req.url);
    
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      const contentType = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml'
      }[ext] || 'application/octet-stream';
      
      res.setHeader('Content-Type', contentType);
      return res.end(fs.readFileSync(filePath));
    }
  }
  
  // Serve index.html for all other routes (SPA)
  const indexPath = path.resolve(distPath, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    res.setHeader('Content-Type', 'text/html');
    res.end(fs.readFileSync(indexPath));
  } else {
    res.status(404).end('App not built properly - missing files');
  }
} 