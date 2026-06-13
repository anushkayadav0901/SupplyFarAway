/// <reference types="@types/google.maps" />
import React, { useEffect, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { trpc } from "../../lib/trpc";
import type { MapData, RouteDirection } from "@server/routers/logistics";

const MAPS = import.meta.env.VITE_GOOGLE_API_KEY as string;

interface MapViewProps {
  /** Existing usage — fetches route data from a persisted draft. */
  draftId?: string;
  /**
   * Inline preview usage — pass route directions directly.
   * When provided, MapView calls trpc.logistics.processRoutes without persisting
   * to a draft (pre-save preview). Takes precedence over draftId.
   */
  inlineRoutes?: { id: string; waypoints: string[]; state: "land" | "sea" | "air" }[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function MapView({ draftId, inlineRoutes }: MapViewProps): React.ReactElement {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);

  // tRPC hooks
  const utils = trpc.useUtils();
  const processRoutesMutation = trpc.logistics.processRoutes.useMutation();
  const updateDraftMutation = trpc.inventory.updateDraft.useMutation();

  // Determine whether there is any data source to render
  const hasInline = inlineRoutes && inlineRoutes.length > 0;
  const hasDraft = Boolean(draftId);

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
        setOptions({
          key: MAPS,
          v: "weekly",
          libraries: ["geometry"],
        });

        const [{ Map: GMap, InfoWindow, Polyline }, { encoding }, { Marker }, { LatLngBounds }] =
          await Promise.all([
            importLibrary("maps"),
            importLibrary("geometry"),
            importLibrary("marker") as Promise<{ Marker: typeof google.maps.Marker }>,
            importLibrary("core"),
          ]);

        const map = new GMap(mapRef.current!, {
          center: { lat: 0, lng: 0 },
          zoom: 2,
          mapTypeId: "roadmap",
        });
        mapInstance.current = map;

        let mapData: MapData;

        if (hasInline) {
          // ── Inline preview path ──────────────────────────────────────────
          // Call processRoutes without a draftId so nothing is persisted.
          const postResponse = await processRoutesMutation.mutateAsync({
            routes: inlineRoutes!,
          });
          mapData = { routes: postResponse.routes, originalRoute: postResponse.originalRoute };
        } else {
          // ── Draft path (existing behavior) ───────────────────────────────
          try {
            mapData = await utils.logistics.getMapData.fetch({ draftId: draftId! });
          } catch {
            // If not found, fetch draft and generate map data
            const draftResponse = await utils.inventory.getDraftById.fetch({
              id: draftId!,
            });
            const draft = (draftResponse as { draft?: { routeData?: { routeDirections?: RouteDirection[] } } })?.draft;
            if (!draft?.routeData?.routeDirections) {
              throw new Error("Draft or route data not found");
            }

            const routesData: RouteDirection[] = draft.routeData.routeDirections.map((d) => ({
              id: d.id,
              waypoints: d.waypoints,
              state: d.state,
            }));

            const postResponse = await processRoutesMutation.mutateAsync({
              routes: routesData,
              draftId: draftId!,
            });

            mapData = { routes: postResponse.routes, originalRoute: postResponse.originalRoute };

            // Persist the freshly-generated mapData onto the draft. Ownership is
            // enforced server-side via requireUserId + scoped findOne, so we do
            // NOT include a userId here (writing it would overwrite the field).
            await updateDraftMutation.mutateAsync({
              id: draftId!,
              updateData: { mapData },
            });
          }
        }

        const { routes: processedRoutes, originalRoute } = mapData;
        const bounds = new LatLngBounds();

        Object.entries(processedRoutes).forEach(([id, route]) => {
          const routeDirection = originalRoute.find((dir) => dir.id === id);
          if (!routeDirection) return;

          if (route.state === "land" && "encodedPolyline" in route) {
            const path = encoding.decodePath(route.encodedPolyline);
            const polyline = new Polyline({
              path,
              geodesic: true,
              strokeColor: "#FF0000",
              strokeOpacity: 1.0,
              strokeWeight: 2,
            });
            polyline.setMap(map);

            const startLatLng = path[0];
            const endLatLng = path[path.length - 1];

            const startMarker = new Marker({
              position: startLatLng,
              map,
              title: routeDirection.waypoints[0],
            });
            const endMarker = new Marker({
              position: endLatLng,
              map,
              title: routeDirection.waypoints[routeDirection.waypoints.length - 1],
            });

            const startInfoWindow = new InfoWindow({
              content: `<div>${routeDirection.waypoints[0]}</div>`,
            });
            const endInfoWindow = new InfoWindow({
              content: `<div>${routeDirection.waypoints[routeDirection.waypoints.length - 1]}</div>`,
            });

            startMarker.addListener("click", () =>
              startInfoWindow.open(map, startMarker)
            );
            endMarker.addListener("click", () =>
              endInfoWindow.open(map, endMarker)
            );

            path.forEach((latLng: google.maps.LatLng) => bounds.extend(latLng));
          } else if (
            (route.state === "air" || route.state === "sea") &&
            "coordinates" in route
          ) {
            const path = route.coordinates.map((coord) => ({
              lat: coord.lat,
              lng: coord.lng,
            }));
            const color = route.state === "air" ? "#00FF00" : "#0000FF";
            const polyline = new Polyline({
              path,
              geodesic: true,
              strokeColor: color,
              strokeOpacity: 1.0,
              strokeWeight: 2,
            });
            polyline.setMap(map);

            const startLatLng = path[0];
            const endLatLng = path[path.length - 1];

            const startMarker = new Marker({
              position: startLatLng,
              map,
              title: routeDirection.waypoints[0],
            });
            const endMarker = new Marker({
              position: endLatLng,
              map,
              title: routeDirection.waypoints[routeDirection.waypoints.length - 1],
            });

            const startInfoWindow = new InfoWindow({
              content: `<div>${routeDirection.waypoints[0]}</div>`,
            });
            const endInfoWindow = new InfoWindow({
              content: `<div>${routeDirection.waypoints[routeDirection.waypoints.length - 1]}</div>`,
            });

            startMarker.addListener("click", () =>
              startInfoWindow.open(map, startMarker)
            );
            endMarker.addListener("click", () =>
              endInfoWindow.open(map, endMarker)
            );

            path.forEach((latLng: { lat: number; lng: number }) => bounds.extend(latLng));
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
    } else if (hasInline || hasDraft) {
      fetchAndRenderMap();
    } else {
      // Neither inlineRoutes nor draftId — show friendly empty state
      setLoading(false);
    }

    return () => {
      isMounted = false;
      if (mapInstance.current) {
        // Cleanup: clear listeners if the maps API is loaded
        if (typeof window !== "undefined" && (window as Window & { google?: { maps?: { event?: { clearInstanceListeners: (inst: object) => void } } } }).google?.maps?.event) {
          (window as Window & { google?: { maps?: { event?: { clearInstanceListeners: (inst: object) => void } } } }).google!.maps!.event!.clearInstanceListeners(mapInstance.current!);
        }
        mapInstance.current = null;
      }
    };
  }, [draftId, inlineRoutes]);

  // Friendly empty state when there is nothing to render
  if (!loading && !error && !hasInline && !hasDraft) {
    return (
      <div className="relative h-96 rounded-lg overflow-hidden shadow-md bg-gray-100 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Plan or pick a route to see the map</p>
      </div>
    );
  }

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
          <p className="text-slate-500 text-sm">
            {error || "Plan a route to see the map"}
          </p>
        </div>
      )}
    </div>
  );
}

export default MapView;
