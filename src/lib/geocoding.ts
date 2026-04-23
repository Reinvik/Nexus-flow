/**
 * Geocoding utility using Nominatim (OpenStreetMap)
 * Respects usage limits by adding a delay between requests.
 */

export async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  if (!address || address.length < 3) return null;

  try {
    // Nominatim policy: 1 request per second max. 
    // We increase to 2s to be very safe and avoid 429/CORS issues.
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Append Chile if not present to increase accuracy in search
    const fullAddress = address.toLowerCase().includes('chile') ? address : `${address}, Chile`;
    const query = encodeURIComponent(fullAddress);
    
    // Use custom headers to identify the app as required by Nominatim policy
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NexusFlow2/1.0 (contact@nexusflow.cl)',
        'Referer': 'http://localhost:3005'
      }
    });

    if (response.status === 429) {
      console.warn('Rate limit hit (429). Waiting longer...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      return null;
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon)
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error for address:', address, error);
    return null;
  }
}

