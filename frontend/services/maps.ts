import axios from 'axios';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export interface DirectionsResult {
  routes: Array<{
    legs: Array<{
      distance: { text: string; value: number };
      duration: { text: string; value: number };
      steps: Array<{
        distance: { text: string; value: number };
        duration: { text: string; value: number };
        html_instructions: string;
        start_location: { lat: number; lng: number };
        end_location: { lat: number; lng: number };
        polyline: { points: string };
      }>;
    }>;
    overview_polyline: { points: string };
    summary: string;
  }>;
}

export interface NavigationStep {
  instruction: string;
  distance: string;
  duration: string;
  lat: number;
  lng: number;
}

class MapsService {
  /**
   * Get directions between two points
   */
  async getDirections(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    waypoints?: Array<{ lat: number; lng: number }>
  ): Promise<DirectionsResult> {
    try {
      const waypointsParam = waypoints
        ? waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|')
        : '';

      const url = `https://maps.googleapis.com/maps/api/directions/json`;
      const params = {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        waypoints: waypointsParam,
        key: GOOGLE_MAPS_API_KEY,
        mode: 'driving',
        alternatives: 'true',
      };

      const response = await axios.get(url, { params });
      
      if (response.data.status !== 'OK') {
        throw new Error(`Directions API error: ${response.data.status}`);
      }

      return response.data;
    } catch (error) {
      console.error('Failed to get directions:', error);
      throw error;
    }
  }

  /**
   * Get optimized route for vehicle dimensions
   */
  async getOptimizedRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    vehicleDimensions: {
      height_meters: number;
      width_meters: number;
      weight_kg: number;
    }
  ) {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/navigation/optimized-route`, {
        origin,
        destination,
        vehicle_dimensions: vehicleDimensions,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get optimized route:', error);
      // Fallback to regular directions
      return this.getDirections(origin, destination);
    }
  }

  /**
   * Search for places
   */
  async searchPlaces(query: string, location?: { lat: number; lng: number }) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json`;
      const params: any = {
        query,
        key: GOOGLE_MAPS_API_KEY,
      };

      if (location) {
        params.location = `${location.lat},${location.lng}`;
        params.radius = 50000; // 50km radius
      }

      const response = await axios.get(url, { params });
      return response.data.results;
    } catch (error) {
      console.error('Failed to search places:', error);
      throw error;
    }
  }

  /**
   * Decode polyline string to coordinates
   */
  decodePolyline(encoded: string): Array<{ latitude: number; longitude: number }> {
    const points: Array<{ latitude: number; longitude: number }> = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  }

  /**
   * Get navigation steps from directions
   */
  getNavigationSteps(directionsResult: DirectionsResult): NavigationStep[] {
    if (!directionsResult.routes || directionsResult.routes.length === 0) {
      return [];
    }

    const route = directionsResult.routes[0];
    const steps: NavigationStep[] = [];

    route.legs.forEach(leg => {
      leg.steps.forEach(step => {
        steps.push({
          instruction: step.html_instructions.replace(/<[^>]*>/g, ''), // Strip HTML tags
          distance: step.distance.text,
          duration: step.duration.text,
          lat: step.start_location.lat,
          lng: step.start_location.lng,
        });
      });
    });

    return steps;
  }
}

export const mapsService = new MapsService();
