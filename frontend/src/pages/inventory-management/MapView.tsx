import React, { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { trpc } from "../../lib/trpc";

const MAPS = import.meta.env.VITE_GOOGLE_API_KEY as string;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LatLng {
  lat: number;
  lng: number;
}

interface RouteDirection {
  id: string;
  waypoints: string[];
  state: string;
}

interface MapViewProps {
  draftId: string | undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function MapView({ draftId }: MapViewProps): React.ReactElement {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);

  // tRPC hooks
  const utils = trpc.useUtils();
  const processRoutesMutation = trpc.logistics.processRoutes.useMutation();
  const updateDraftMutation = trpc.inventory.updateDraft.useMutation();

  useEffect(() => {
    let isMounted = true;

    const fetchAndRenderMap = async () => {
      if (!isMounted) return;

      if (!mapRef.current) {
        setError("Map container not found");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const loader = new Loader({
          apiKey: MAPS,
          version: "weekly",
          libraries: ["geometry"],
        });

        const google = await loader.load();

        const map = new google.maps.Map(mapRef.current!, {
          center: { lat: 0, lng: 0 },
          zoom: 2,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
        });
        mapInstance.current = map;

        if (!draftId) throw new Error("No draft ID provided");

        let mapData: {
          routes: Record<string, unknown>;
          originalRoute: RouteDirection[];
        };

        try {
          // Try to get existing map data
          const response = await utils.logistics.getMapData.fetch({
            draftId,
          });
          mapData = response as any;
        } catch {
          // If not found, fetch draft and generate map data
          const draftResponse = await utils.inventory.getDraftById.fetch({
            id: draftId,
          });
          const draft = (draftResponse as any)?.draft;
          if (!draft || !draft.routeData?.routeDirections) {
            throw new Error("Draft or route data not found");
          }

          const routesData: RouteDirection[] =
            draft.routeData.routeDirections.map((direction: any) => ({
              id: direction.id,
              waypoints: direction.waypoints,
              state: direction.state,
            }));

          const postResponse = await processRoutesMutation.mutateAsync({
            routes: routesData.map((r) => ({
              id: r.id,
              waypoints: r.waypoints,
              state: r.state as "land" | "sea" | "air",
            })),
            draftId,
          });

          mapData = {
            routes: postResponse as unknown as Record<string, unknown>,
            originalRoute: routesData,
          };

          // Persist the freshly-generated mapData onto the draft. Ownership is
          // enforced server-side via requireUserId + scoped findOne, so we do
          // NOT include a userId here (writing it would overwrite the field).
          await updateDraftMutation.mutateAsync({
            id: draftId,
            updateData: { mapData },
          });
        }

        const { routes: processedRoutes, originalRoute } = mapData;
        const bounds = new google.maps.LatLngBounds();

        Object.entries(processedRoutes).forEach(([id, routeRaw]) => {
          if (id === "draftId") return;
          const route = routeRaw as any;
          const routeDirection = (originalRoute as RouteDirection[]).find(
            (dir) => dir.id === id
          );
          if (!routeDirection) return;

          if (route.state === "land" && route.encodedPolyline) {
            const path = google.maps.geometry.encoding.decodePath(
              route.encodedPolyline
            );
            const polyline = new google.maps.Polyline({
              path,
              geodesic: true,
              strokeColor: "#FF0000",
              strokeOpacity: 1.0,
              strokeWeight: 2,
            });
            polyline.setMap(map);

            const startLatLng = path[0];
            const endLatLng = path[path.length - 1];

            const startMarker = new google.maps.Marker({
              position: startLatLng,
              map,
              title: routeDirection.waypoints[0],
            });
            const endMarker = new google.maps.Marker({
              position: endLatLng,
              map,
              title: routeDirection.waypoints[1],
            });

            const startInfoWindow = new google.maps.InfoWindow({
              content: `<div>${routeDirection.waypoints[0]}</div>`,
            });
            const endInfoWindow = new google.maps.InfoWindow({
              content: `<div>${routeDirection.waypoints[1]}</div>`,
            });

            startMarker.addListener("click", () =>
              startInfoWindow.open(map, startMarker)
            );
            endMarker.addListener("click", () =>
              endInfoWindow.open(map, endMarker)
            );

            path.forEach((latLng) => bounds.extend(latLng));
          } else if (
            (route.state === "air" || route.state === "sea") &&
            route.coordinates
          ) {
            const path: LatLng[] = route.coordinates.map((coord: LatLng) => ({
              lat: coord.lat,
              lng: coord.lng,
            }));
            const color = route.state === "air" ? "#00FF00" : "#0000FF";
            const polyline = new google.maps.Polyline({
              path,
              geodesic: true,
              strokeColor: color,
              strokeOpacity: 1.0,
              strokeWeight: 2,
            });
            polyline.setMap(map);

            const startLatLng = path[0];
            const endLatLng = path[path.length - 1];

            const startMarker = new google.maps.Marker({
              position: startLatLng,
              map,
              title: routeDirection.waypoints[0],
            });
            const endMarker = new google.maps.Marker({
              position: endLatLng,
              map,
              title: routeDirection.waypoints[1],
            });

            const startInfoWindow = new google.maps.InfoWindow({
              content: `<div>${routeDirection.waypoints[0]}</div>`,
            });
            const endInfoWindow = new google.maps.InfoWindow({
              content: `<div>${routeDirection.waypoints[1]}</div>`,
            });

            startMarker.addListener("click", () =>
              startInfoWindow.open(map, startMarker)
            );
            endMarker.addListener("click", () =>
              endInfoWindow.open(map, endMarker)
            );

            path.forEach((latLng) => bounds.extend(latLng));
          }
        });

        if (isMounted && !bounds.isEmpty()) {
          map.fitBounds(bounds);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError((err as Error).message || "Failed to load map data");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (!MAPS) {
      setError("Map service is unavailable — Google Maps API key is not configured.");
      setLoading(false);
    } else if (draftId) {
      fetchAndRenderMap();
    } else {
      setError("No draft ID provided. Please navigate from Route Optimization.");
      setLoading(false);
    }

    return () => {
      isMounted = false;
      if (mapInstance.current) {
        if (typeof google !== "undefined" && google.maps?.event) {
          google.maps.event.clearInstanceListeners(mapInstance.current);
        }
        mapInstance.current = null;
      }
    };
  }, [draftId]);

  return (
    <div className="relative h-96 rounded-lg overflow-hidden shadow-md">
      <div
        ref={mapRef}
        style={{ width: "100%", height: "100%" }}
        className="absolute top-0 left-0 w-full h-full"
      />

      {loading && (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-gray-100 bg-opacity-75 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-600 font-medium">Loading map...</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="absolute top-0 left-0 w-full h-full bg-gray-100 bg-opacity-75 rounded-lg flex items-center justify-center">
          <p className="text-gray-600">
            {error || "No routes available to display"}
          </p>
        </div>
      )}
    </div>
  );
}

export default MapView;
