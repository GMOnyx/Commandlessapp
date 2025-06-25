// Test Railway API connectivity
import fetch from 'node-fetch';

async function testRailway() {
  console.log('🚂 Testing Railway API...');
  
  const railwayToken = '4d56303a-25cd-411d-b2f7-0f44c6d0f49c'; // Your token from earlier
  const projectId = 'e09a4f1b-1960-4d7a-9e1a-45540806d41b'; // Your project ID
  
  try {
    console.log('📡 Making GraphQL request to Railway...');
    
    const response = await fetch('https://backboard.railway.com/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${railwayToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          query {
            me {
              id
              name
              email
            }
          }
        `
      })
    });

    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const result = await response.text();
    console.log('📋 Response body:', result);
    
    if (response.ok) {
      const data = JSON.parse(result);
      if (data.data?.me) {
        console.log('✅ Railway API working! User:', data.data.me.name);
        
        // Test project access
        const projectResponse = await fetch('https://backboard.railway.com/graphql/v2', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${railwayToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: `
              query($id: String!) {
                project(id: $id) {
                  id
                  name
                  services {
                    edges {
                      node {
                        id
                        name
                      }
                    }
                  }
                }
              }
            `,
            variables: { id: projectId }
          })
        });
        
        const projectResult = await projectResponse.json();
        console.log('📦 Project access:', projectResult);
        
        if (projectResult.data?.project) {
          console.log('✅ Project access working!');
          console.log('📋 Services:', projectResult.data.project.services.edges.length);
        } else {
          console.log('❌ Project access failed:', projectResult.errors);
        }
        
      } else {
        console.log('❌ Authentication failed:', data.errors);
      }
    } else {
      console.log('❌ Railway API failed:', result);
    }
    
  } catch (error) {
    console.error('❌ Error testing Railway:', error);
  }
}

testRailway(); 