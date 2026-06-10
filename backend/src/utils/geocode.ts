import axios from "axios";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

export interface LatLng {
  lat: number;
  lng: number;
}

export async function geocodeAddress(address: string): Promise<LatLng> {
  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      {
        params: { address, key: GOOGLE_API_KEY },
      }
    );

    if (response.data.status === "OK" && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    }

    console.error(
      `Geocoding failed for address: ${address}, Status: ${response.data.status}, Error message: ${
        response.data.error_message || "No message"
      }`
    );
    throw new Error(`Geocoding failed for address: ${address}`);
  } catch (error) {
    console.error("Geocoding error:", error);
    throw error;
  }
}

export async function getDirections(waypoints: string[]): Promise<string> {
  try {
    const waypointsLatLng = await Promise.all(waypoints.map(geocodeAddress));
    const routesApiUrl =
      "https://routes.googleapis.com/directions/v2:computeRoutes";

    const requestData: Record<string, unknown> = {
      origin: {
        location: {
          latLng: {
            latitude: waypointsLatLng[0].lat,
            longitude: waypointsLatLng[0].lng,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: waypointsLatLng[waypointsLatLng.length - 1].lat,
            longitude: waypointsLatLng[waypointsLatLng.length - 1].lng,
          },
        },
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: false,
      routeModifiers: {
        avoidTolls: false,
        avoidHighways: false,
        avoidFerries: false,
      },
      languageCode: "en-US",
      units: "IMPERIAL",
    };

    if (waypointsLatLng.length > 2) {
      requestData.intermediates = waypointsLatLng.slice(1, -1).map((point) => ({
        location: { latLng: { latitude: point.lat, longitude: point.lng } },
      }));
    }

    const headers = {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_API_KEY ?? "",
      "X-Goog-FieldMask": "routes.polyline.encodedPolyline",
    };

    const response = await axios.post(routesApiUrl, requestData, { headers });
    if (!response.data.routes || response.data.routes.length === 0) {
      throw new Error("No routes found");
    }
    return response.data.routes[0].polyline.encodedPolyline as string;
  } catch (error) {
    console.error("Error getting directions:", error);
    throw error;
  }
}
