export const config = {
  runtime: 'edge',
}

export default async function handler(request) {
  return new Response(
    JSON.stringify({
      message: 'Edge function working!',
      timestamp: new Date().toISOString(),
      method: request.method,
      url: request.url,
      runtime: 'edge'
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    }
  );
} 