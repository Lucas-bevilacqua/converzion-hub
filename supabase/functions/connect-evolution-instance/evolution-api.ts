import { corsHeaders } from './cors.ts'

export async function checkInstance(baseUrl: string, evolutionApiKey: string, instanceName: string) {
  console.log('Checking instances at:', `${baseUrl}/instance/fetchInstances`)
  
  try {
    const checkResponse = await fetch(`${baseUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': evolutionApiKey,
        'Content-Type': 'application/json'
      }
    })

    if (!checkResponse.ok) {
      const errorText = await checkResponse.text()
      console.error('Evolution API check instance error:', errorText)
      throw new Error(`Evolution API check failed: ${errorText}`)
    }

    const instances = await checkResponse.json()
    console.log('Available instances:', instances)
    
    return instances.find((inst: any) => inst.instanceName === instanceName)
  } catch (error) {
    console.error('Error checking instance:', error)
    throw error
  }
}

export async function createInstance(baseUrl: string, evolutionApiKey: string, instanceName: string) {
  console.log('Creating new instance:', instanceName)
  
  try {
    const createResponse = await fetch(`${baseUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'apikey': evolutionApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instanceName: instanceName,
        token: "any",
        qrcode: true,
        integration: "WHATSAPP-BAILEYS"
      })
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      console.error('Evolution API create instance error:', errorText)
      if (!errorText.includes('already in use')) {
        throw new Error(`Failed to create instance: ${errorText}`)
      }
    }
  } catch (error) {
    console.error('Error creating instance:', error)
    throw error
  }
}

export async function connectInstance(baseUrl: string, evolutionApiKey: string, instanceName: string) {
  const connectUrl = `${baseUrl}/instance/connect/${instanceName}`
  console.log('Connecting to instance at:', connectUrl)
  
  try {
    const evolutionResponse = await fetch(connectUrl, {
      method: 'GET',
      headers: {
        'apikey': evolutionApiKey,
        'Content-Type': 'application/json'
      }
    })

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text()
      console.error('Evolution API connect error:', errorText)
      throw new Error(`Evolution API returned status ${evolutionResponse.status}: ${errorText}`)
    }

    const evolutionData = await evolutionResponse.json()
    console.log('Evolution API response:', evolutionData)
    
    return evolutionData
  } catch (error) {
    console.error('Error connecting instance:', error)
    throw error
  }
}