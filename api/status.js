export default async function handler(request, response) {
  // Set CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  return response.status(200).json({
    status: 'ok',
    message: 'New API pattern working!',
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url
  });
} 