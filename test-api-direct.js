// Quick test to see what the API is actually returning
// Run this in your browser console on the commandless.app page

async function testAPI() {
  try {
    // Get the auth token from Clerk
    const token = await window.Clerk?.session?.getToken();
    console.log('Token length:', token?.length);
    
    // Call the bots API directly
    const response = await fetch('/api/bots', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('API Response Status:', response.status);
    console.log('API Response Data:', data);
    
    return data;
  } catch (error) {
    console.error('API Test Error:', error);
  }
}

// Run the test
testAPI(); 