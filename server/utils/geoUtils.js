const axios = require('axios');

// API Key provided by user
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyDIEaV68VV16To1fjfUbD-4Bz7JxkIpfGU';

// Example input: https://www.google.com/maps/@35.6585805,139.7454329,3a,75y,90t/data=!3m6!1e1!3m4!1sPANO_ID_HERE!2e0!7i13312!8i6656
function parseGoogleMapsLink(input) {
    try {
        // If input is just a Pano ID (alphanumeric, usually 22+ chars, no spaces)
        if (!input.includes('/') && !input.includes('google.com') && input.length > 10) {
            return { panoId: input.trim(), lat: 0, lng: 0 };
        }

        const urlObj = new URL(input);
        let panoId = null;
        let lat = 0;
        let lng = 0;

        // Extract Lat/Lng from URL path (e.g. /@35.6585805,139.7454329,3a...)
        const pathParts = urlObj.pathname.split('@');
        if (pathParts.length > 1) {
            const coords = pathParts[1].split(',');
            if (coords.length >= 2) {
                lat = parseFloat(coords[0]) || 0;
                lng = parseFloat(coords[1]) || 0;
            }
        }

        // Extract Pano ID from path (old style)
        const dataPath = urlObj.pathname;
        if (dataPath.includes('!1s')) {
            const parts = dataPath.split('!1s');
            if (parts[1]) {
                panoId = parts[1].split('!')[0];
            }
        }

        // Extract Pano ID from query params (new style)
        if (!panoId && urlObj.searchParams.has('pano')) {
            panoId = urlObj.searchParams.get('pano');
        }

        if (panoId || (lat !== 0 && lng !== 0)) {
            return { panoId, lat, lng };
        }
        return null;
    } catch (e) {
        // Fallback for raw Pano ID
        if (input && !input.includes(' ') && input.length > 10) {
             return { panoId: input.trim(), lat: 0, lng: 0 };
        }
        return null;
    }
}

/**
 * Resolves a location string (URL or PanoID) to a valid PanoID + Lat/Lng using Google API
 */
async function resolveLocation(input) {
    const parsed = parseGoogleMapsLink(input);
    if (!parsed) return null;

    try {
        let url = `https://maps.googleapis.com/maps/api/streetview/metadata?key=${GOOGLE_MAPS_API_KEY}`;
        
        if (parsed.panoId) {
            url += `&pano=${parsed.panoId}`;
        } else if (parsed.lat !== 0 && parsed.lng !== 0) {
            // Use radius=50000 and source=outdoor to find nearest official coverage
            url += `&location=${parsed.lat},${parsed.lng}&radius=50000&source=outdoor`;
        } else {
            return null;
        }

        const res = await axios.get(url);
        
        if (res.data && res.data.status === 'OK') {
            return {
                panoId: res.data.pano_id,
                lat: res.data.location.lat,
                lng: res.data.location.lng
            };
        } else {
            console.warn(`Google Maps API Error for input "${input}":`, res.data.status);
            return null;
        }
    } catch (err) {
        console.error('Failed to resolve location:', err.message);
        return null;
    }
}

async function refreshLocationMetadata(loc) {
    try {
        let url = `https://maps.googleapis.com/maps/api/streetview/metadata?key=${GOOGLE_MAPS_API_KEY}`;
        
        // Strategy 1: Use Lat/Lng if available (Preferred as per requirement)
        if (loc.lat && loc.lng && (loc.lat !== 0 || loc.lng !== 0)) {
             url += `&location=${loc.lat},${loc.lng}&radius=50000&source=outdoor`;
        } 
        // Strategy 2: Use Pano ID
        else if (loc.pano_id) {
            url += `&pano=${loc.pano_id}`;
        } else {
            return null;
        }

        const res = await axios.get(url);
        if (res.data && res.data.status === 'OK') {
            return {
                panoId: res.data.pano_id,
                lat: res.data.location.lat,
                lng: res.data.location.lng
            };
        }
        
        // Fallback: If Strategy 1 failed, try Strategy 2 (Pano ID) if we haven't already
        if (loc.lat && loc.lng && loc.pano_id) {
             const url2 = `https://maps.googleapis.com/maps/api/streetview/metadata?key=${GOOGLE_MAPS_API_KEY}&pano=${loc.pano_id}`;
             const res2 = await axios.get(url2);
             if (res2.data && res2.data.status === 'OK') {
                return {
                    panoId: res2.data.pano_id,
                    lat: res2.data.location.lat,
                    lng: res2.data.location.lng
                };
            }
        }

        return null;
    } catch (err) {
        console.error('Failed to refresh location:', err.message);
        return null;
    }
}

module.exports = { parseGoogleMapsLink, resolveLocation, refreshLocationMetadata };
