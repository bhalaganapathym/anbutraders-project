export interface GpsLocationItem {
  raw: string;
  label: string;
  coordsText: string;
  lat?: number;
  lng?: number;
  mapsUrl: string;
}

export interface CategorizedAddresses {
  normalAddresses: string[];
  gpsLocations: GpsLocationItem[];
}

/**
 * Extracts GPS coordinates from various string formats:
 * - "Barathidasan street (GPS: 12.00090, 79.77123)"
 * - "GPS: 12.00090, 79.77123"
 * - "https://maps.google.com/?q=12.00090,79.77123"
 * - "12.00090, 79.77123"
 */
export function extractGpsInfo(addressStr: string): {
  isGps: boolean;
  lat?: number;
  lng?: number;
  label: string;
  coordsText: string;
  mapsUrl: string;
} {
  const trimmed = (addressStr || '').trim();
  if (!trimmed) {
    return { isGps: false, label: '', coordsText: '', mapsUrl: '' };
  }

  // 1. Check for standard GPS pattern e.g. GPS: 12.345, 78.910 or (GPS: 12.345, 78.910)
  const gpsCoordMatch = trimmed.match(/(?:GPS:\s*|\bq=|\blocation=|\bcoord(?:s)?:\s*|\()([+-]?\d+\.\d+)\s*,\s*([+-]?\d+\.\d+)/i);
  
  // 2. Check for bare coordinates e.g. "12.34567, 78.91011"
  const bareCoordMatch = !gpsCoordMatch ? trimmed.match(/^([+-]?\d+\.\d{3,})\s*,\s*([+-]?\d+\.\d{3,})$/) : null;
  
  // 3. Check for Google Maps URL
  const mapsUrlMatch = trimmed.match(/https?:\/\/(?:maps\.google\.com|goo\.gl|maps\.app\.goo\.gl)[^\s)]+/i);

  const matched = gpsCoordMatch || bareCoordMatch;

  if (matched || mapsUrlMatch || trimmed.toLowerCase().includes('gps:')) {
    let lat: number | undefined;
    let lng: number | undefined;

    if (matched) {
      lat = parseFloat(matched[1]);
      lng = parseFloat(matched[2]);
    } else if (mapsUrlMatch) {
      const urlLatMatch = mapsUrlMatch[0].match(/q=([+-]?\d+\.\d+),([+-]?\d+\.\d+)/);
      if (urlLatMatch) {
        lat = parseFloat(urlLatMatch[1]);
        lng = parseFloat(urlLatMatch[2]);
      }
    }

    let coordsText = '';
    if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
      coordsText = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }

    // Clean up label by removing the (GPS: ...) or GPS: ... or URL
    let label = trimmed
      .replace(/\(GPS:\s*[0-9.,\s-]+\)/gi, '')
      .replace(/GPS:\s*[0-9.,\s-]+/gi, '')
      .replace(/https?:\/\/[^\s)]+/gi, '')
      .replace(/[(),]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!label) {
      label = coordsText ? `Site Pin (${coordsText})` : 'Saved Site Location';
    }

    const mapsUrl = (lat !== undefined && lng !== undefined)
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      : (mapsUrlMatch ? mapsUrlMatch[0] : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`);

    return {
      isGps: true,
      lat,
      lng,
      label,
      coordsText: coordsText || (lat && lng ? `${lat}, ${lng}` : 'Map Location'),
      mapsUrl
    };
  }

  return {
    isGps: false,
    label: trimmed,
    coordsText: '',
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`
  };
}

/**
 * Categorizes and deduplicates addresses into:
 * 1. Normal text addresses
 * 2. GPS site locations
 * 
 * Strict deduplication ensures:
 * - No duplicate text strings (case-insensitive & whitespace normalized)
 * - No duplicate GPS pins (matching label + coordinates within 50 meters)
 */
export function parseAndCategorizeAddresses(addresses: (string | null | undefined)[]): CategorizedAddresses {
  const normalSet = new Set<string>();
  const normalAddresses: string[] = [];
  const gpsLocations: GpsLocationItem[] = [];

  for (const raw of addresses) {
    if (!raw || typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const info = extractGpsInfo(trimmed);

    if (info.isGps) {
      // Check for duplicate GPS entry
      const isDuplicate = gpsLocations.some(existing => {
        // Exact raw string match
        if (existing.raw.toLowerCase() === trimmed.toLowerCase()) return true;

        // If coordinates match
        if (info.lat !== undefined && info.lng !== undefined && existing.lat !== undefined && existing.lng !== undefined) {
          const dLat = Math.abs(existing.lat - info.lat);
          const dLng = Math.abs(existing.lng - info.lng);
          // Within ~0.0005 deg (~50 meters) and same label (or one label is generic)
          if (dLat < 0.0005 && dLng < 0.0005) {
            const sameLabel = existing.label.toLowerCase() === info.label.toLowerCase() ||
                              existing.label.includes('Site Pin') ||
                              info.label.includes('Site Pin');
            if (sameLabel) return true;
          }
        }

        // Same label and same coordsText
        if (existing.coordsText && info.coordsText && existing.coordsText === info.coordsText && existing.label.toLowerCase() === info.label.toLowerCase()) {
          return true;
        }

        return false;
      });

      if (!isDuplicate) {
        gpsLocations.push({
          raw: trimmed,
          label: info.label,
          coordsText: info.coordsText,
          lat: info.lat,
          lng: info.lng,
          mapsUrl: info.mapsUrl
        });
      }
    } else {
      // Normal address deduplication
      const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');
      if (!normalSet.has(normalized)) {
        normalSet.add(normalized);
        normalAddresses.push(trimmed);
      }
    }
  }

  return { normalAddresses, gpsLocations };
}
