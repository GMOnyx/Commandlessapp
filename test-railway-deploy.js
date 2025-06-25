// Test Railway service creation manually
import fetch from 'node-fetch';

async function createTestBotService() {
  console.log('🚂 Creating test Railway service...');
  
  const railwayToken = '4d56303a-25cd-411d-b2f7-0f44c6d0f49c';
  const projectId = 'e09a4f1b-1960-4d7a-9e1a-45540806d41b';
  
  try {
    // Create a service
    const response = await fetch('https://backboard.railway.com/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${railwayToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          mutation ServiceCreate($input: ServiceCreateInput!) {
            serviceCreate(input: $input) {
              id
              name
            }
          }
        `,
        variables: {
          input: {
            name: `discord-bot-test-${Date.now()}`,
            projectId: projectId
          }
        }
      })
    });

    const result = await response.json();
    console.log('📋 Service creation result:', JSON.stringify(result, null, 2));
    
    if (result.data?.serviceCreate?.id) {
      console.log('✅ Service created successfully!');
      console.log('🆔 Service ID:', result.data.serviceCreate.id);
      
      // Set environment variables
      const serviceId = result.data.serviceCreate.id;
      const envVars = {
        BOT_TOKEN: 'test-token-123',
        BOT_ID: 'test-bot-id',
        BOT_NAME: 'Test Bot',
        COMMANDLESS_API_URL: 'https://commandless.app'
      };

      for (const [key, value] of Object.entries(envVars)) {
        const envResponse = await fetch('https://backboard.railway.com/graphql/v2', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${railwayToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: `
              mutation VariableUpsert($input: VariableUpsertInput!) {
                variableUpsert(input: $input) {
                  id
                  name
                  value
                }
              }
            `,
            variables: {
              input: {
                serviceId: serviceId,
                name: key,
                value: value
              }
            }
          })
        });

        const envResult = await envResponse.json();
        console.log(`✅ Set ${key}:`, envResult.data?.variableUpsert ? 'Success' : 'Failed');
      }
      
      console.log('🎉 Railway service is ready for bot deployment!');
      
    } else {
      console.log('❌ Service creation failed:', result.errors);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createTestBotService(); 