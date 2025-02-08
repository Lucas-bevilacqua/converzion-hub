import { corsHeaders } from './cors.ts'

export async function checkInstance(baseUrl: string, evolutionApiKey: string, instanceName: string) {
  // Remove any trailing slashes and colons from the base URL
  const cleanBaseUrl = baseUrl.replace(/[:/]+$/, '')
  console.log('Checking instances at:', `${cleanBaseUrl}/instance/fetchInstances`)
  
  try {
    const checkResponse = await fetch(`${cleanBaseUrl}/instance/fetchInstances`, {
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
  // Remove any trailing slashes and colons from the base URL
  const cleanBaseUrl = baseUrl.replace(/[:/]+$/, '')
  console.log('Creating new instance:', instanceName)
  
  try {
    const createResponse = await fetch(`${cleanBaseUrl}/instance/create`, {
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

    const responseData = await createResponse.json()
    console.log('Create instance response:', responseData)
    
    return responseData
  } catch (error) {
    console.error('Error creating instance:', error)
    throw error
  }
}

export async function connectInstance(baseUrl: string, evolutionApiKey: string, instanceName: string) {
  // Remove any trailing slashes and colons from the base URL
  const cleanBaseUrl = baseUrl.replace(/[:/]+$/, '')
  const connectUrl = `${cleanBaseUrl}/instance/connect/${instanceName}`
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
    
    // Validate QR code presence in response
    const hasQRCode = evolutionData.base64 || 
                     evolutionData.qrcode?.base64 || 
                     evolutionData.qrcode || 
                     evolutionData.data?.qrcode?.base64 || 
                     evolutionData.data?.qrcode

    if (!hasQRCode) {
      console.error('No QR code found in response:', evolutionData)
      throw new Error('Evolution API response missing QR code')
    }

    return evolutionData
  } catch (error) {
    console.error('Error connecting instance:', error)
    throw error
  }
}