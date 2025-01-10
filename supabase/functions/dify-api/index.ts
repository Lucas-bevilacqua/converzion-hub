import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DifyConfig {
  apiKey: string;
  apiUrl: string;
}

async function getDifyConfig(): Promise<DifyConfig> {
  const apiKey = Deno.env.get('DIFY_API_KEY');
  const apiUrl = Deno.env.get('DIFY_API_URL');

  if (!apiKey || !apiUrl) {
    throw new Error('Missing Dify configuration');
  }

  return { apiKey, apiUrl };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const config = await getDifyConfig();
    console.log('Got Dify config, making request...');

    // Get the request body
    const { action } = await req.json();
    console.log('Action requested:', action);

    let endpoint;
    let method = 'GET';
    let body;

    switch (action) {
      case 'list-applications':
        endpoint = '/applications';
        break;
      case 'create-application':
        endpoint = '/applications';
        method = 'POST';
        body = {
          name: "WhatsApp Assistant",
          mode: "completion",
          model: {
            provider: "openai",
            name: "gpt-3.5-turbo",
            mode: "chat"
          }
        };
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log('Making request to:', `${config.apiUrl}${endpoint}`);
    
    const response = await fetch(`${config.apiUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      body: method === 'POST' ? JSON.stringify(body) : undefined
    });

    console.log('Got response:', response.status);
    const data = await response.json();
    console.log('Response data:', data);

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
})