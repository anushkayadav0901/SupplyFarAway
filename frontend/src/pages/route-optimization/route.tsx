import React, { useEffect, useState, useRef } from "react";
import {
  GoogleMap,
  LoadScript,
  Marker,
  InfoWindow,
} from "@react-google-maps/api";
import { useParams } from "react-router-dom";
import { trpc } from "../../lib/trpc";

const MAPS = import.meta.env.VITE_GOOGLE_API_KEY as string;

// *** Define libraries array outside the component to prevent re-renders ***
const libraries: ("geometry" | "drawing" | "places" | "visualization")[] = ["geometry"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LatLng {
  lat: number;
  lng: number;
}

interface FormattedRoute {
  encodedPolyline?: string;
  coordinates?: LatLng[];
  state: string;
  origin: string;
  destination: string;
  name: string;
  error?: string;
}

interface FormattedRoutes {
  [id: string]: FormattedRoute;
}

interface RouteTypeInfo {
  color?: string;
  textColor?: string;
  bgColor?: string;
  borderColor?: string;
  name?: string;
  icon?: string;
}

interface AnimatedVehicleProps {
  path: LatLng[];
  routeType: string;
  shouldAnimate: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decodePolyline(encoded: string): LatLng[] {
  if (!encoded || typeof encoded !== "string") {
    console.warn("Invalid polyline encoding:", encoded);
    return [];
  }

  const poly: LatLng[] = [];
  let index = 0,
    lat = 0,
    lng = 0;

  try {
    while (index < encoded.length) {
      let b: number,
        shift = 0,
        result = 0;
      do {
        if (index >= encoded.length) break;
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20 && index < encoded.length);

      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;
      shift = 0;
      result = 0;

      do {
        if (index >= encoded.length) break;
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20 && index < encoded.length);

      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      const latValue = lat / 1e5;
      const lngValue = lng / 1e5;

      if (
        !isNaN(latValue) &&
        !isNaN(lngValue) &&
        latValue >= -90 &&
        latValue <= 90 &&
        lngValue >= -180 &&
        lngValue <= 180
      ) {
        poly.push({ lat: latValue, lng: lngValue });
      }
    }
  } catch (error) {
    console.error("Error in polyline decoding:", error);
    return [];
  }

  return poly;
}

// ---------------------------------------------------------------------------
// AnimatedVehicle
// ---------------------------------------------------------------------------

function AnimatedVehicle({ path, routeType, shouldAnimate }: AnimatedVehicleProps): React.ReactElement | null {
  const [currentPosition, setCurrentPosition] = useState<LatLng | null>(null);
  const [animationProgress, setAnimationProgress] = useState<number>(0);
  const animationRef = useRef<number | undefined>(undefined);
  const animationStartTimeRef = useRef<number | null>(null);
  const animationDuration = 8000;

  useEffect(() => {
    if (!shouldAnimate || !path || path.length < 2) {
      setCurrentPosition(null);
      setAnimationProgress(0);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      animationStartTimeRef.current = null;
      return;
    }

    const animate = (timestamp: number) => {
      if (!animationStartTimeRef.current) {
        animationStartTimeRef.current = timestamp;
      }

      const elapsed = timestamp - animationStartTimeRef.current;
      const progress = Math.min(elapsed / animationDuration, 1);

      setAnimationProgress(progress);

      const totalPoints = path.length - 1;
      const currentSegment = progress * totalPoints;
      const segmentIndex = Math.floor(currentSegment);
      const segmentProgress = currentSegment - segmentIndex;

      if (segmentIndex < totalPoints) {
        const startPoint = path[segmentIndex];
        const endPoint = path[segmentIndex + 1];

        const latVal =
          startPoint.lat + (endPoint.lat - startPoint.lat) * segmentProgress;
        const lngVal =
          startPoint.lng + (endPoint.lng - startPoint.lng) * segmentProgress;

        setCurrentPosition({ lat: latVal, lng: lngVal });
      } else {
        setCurrentPosition(path[path.length - 1]);
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [shouldAnimate, path, routeType]);

  if (!shouldAnimate || !path || path.length < 2 || !currentPosition) return null;

  const getVehicleIcon = (): google.maps.Icon | undefined => {
    const iconSize = 60;
    switch (routeType) {
      case "land":
        return {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg width="800px" height="800px" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_901_3167)"><path d="M27.9731 6L28.9731 17H18.9731V5H26.9731C27.5031 5 27.8831 5.27 27.9731 6Z" fill="#FFE6EA"/><path d="M24.9731 25C26.6331 25 27.9731 26.34 27.9731 28C27.9731 29.66 26.6331 31 24.9731 31C23.3131 31 21.9731 29.66 21.9731 28C21.9731 26.34 23.3131 25 24.9731 25ZM7.97308 25C9.63308 25 10.9731 26.34 10.9731 28C10.9731 29.66 9.63308 31 7.97308 31C6.31308 31 4.97308 29.66 4.97308 28C4.97308 27.69 5.02308 27.38 5.11308 27.1C5.49308 25.88 6.62308 25 7.97308 25Z" fill="#668077"/></g></svg>`)}`,
          scaledSize: new window.google.maps.Size(iconSize, iconSize),
          anchor: new window.google.maps.Point(iconSize / 2, iconSize / 2),
        };
      case "sea":
        return {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><polygon style="fill:#5E4E44;" points="512,197.066 488.031,390.208 472.377,447.604 39.623,447.604 32.041,419.884 23.969,390.208 0,197.066"/></svg>`)}`,
          scaledSize: new window.google.maps.Size(iconSize, iconSize),
          anchor: new window.google.maps.Point(iconSize / 2, iconSize / 2),
        };
      case "air":
        return {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg viewBox="0 0 511.988 511.988" xmlns="http://www.w3.org/2000/svg"><path style="fill:#5D9CEC;" d="M287.511,479.994h-64c-5.766,0-10.484-4.578-10.656-10.344c-0.438-14.375-10.672-352.399-10.672-373.649c0-13.344,5.047-31.078,12.875-45.179C224.61,31.807,238.985,21.338,254.501,21.338s29.891,10.469,40.437,29.484c7.828,14.101,12.891,31.835,12.891,45.179c0,21.25-10.234,359.274-10.672,373.649C297.994,475.416,293.275,479.994,287.511,479.994z"/></svg>`)}`,
          scaledSize: new window.google.maps.Size(iconSize, iconSize),
          anchor: new window.google.maps.Point(iconSize / 2, iconSize / 2),
        };
      default:
        return undefined;
    }
  };

  const icon = getVehicleIcon();
  if (!icon) return null;

  return (
    <Marker
      position={currentPosition}
      icon={icon}
      zIndex={3000}
      title={`${routeType} vehicle - ${Math.round(animationProgress * 100)}% complete`}
    />
  );
}

// ---------------------------------------------------------------------------
// RouteMap
// ---------------------------------------------------------------------------

function RouteMap(): React.ReactElement {
  const { draftId } = useParams<{ draftId: string }>();
  const [routes, setRoutes] = useState<FormattedRoutes>({});
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState<boolean>(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [animationTrigger, setAnimationTrigger] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<string>("custom");
  const mapRef = useRef<google.maps.Map | null>(null);
  const polylineInstancesRef = useRef<google.maps.Polyline[]>([]);
  const markersRef = useRef<google.maps.Marker[]>([]);

  const { data: mapDataRaw, isLoading: loading, isError, error } = trpc.logistics.getMapData.useQuery(
    { draftId: draftId ?? "" },
    { enabled: !!draftId }
  );

  const mapCenter = { lat: 0, lng: 0 };
  const mapZoom = 2;

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setShowSidebar(!mobile);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Format routes when data arrives
  useEffect(() => {
    if (!mapDataRaw) return;

    const data = mapDataRaw as any;
    const processedRoutes = data.routes as Record<string, any>;
    const originalRoute = data.originalRoute as Array<{
      id: string;
      waypoints: string[];
      state: string;
    }>;

    if (!processedRoutes || !originalRoute) return;

    const formattedRoutes: FormattedRoutes = {};
    Object.entries(processedRoutes).forEach(([id, route]: [string, any]) => {
      const routeDirection = originalRoute.find((dir) => dir.id === id);
      if (!routeDirection) return;
      formattedRoutes[id] = {
        ...route,
        origin: routeDirection.waypoints[0],
        destination: routeDirection.waypoints[1],
        name: `${routeDirection.waypoints[0]} to ${routeDirection.waypoints[1]}`,
        state: routeDirection.state,
      };
    });

    setRoutes(formattedRoutes);
  }, [mapDataRaw]);

  // Create native Google Maps polylines
  useEffect(() => {
    if (
      mapRef.current &&
      Object.keys(routes).length > 0 &&
      isGoogleLoaded &&
      window.google?.maps
    ) {
      polylineInstancesRef.current.forEach((polyline) => polyline.setMap(null));
      polylineInstancesRef.current = [];

      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];

      Object.entries(routes).forEach(([id, route]) => {
        try {
          let path: LatLng[] = [];

          if (route.state === "land" && route.encodedPolyline && !route.error) {
            if (window.google?.maps?.geometry?.encoding) {
              const decoded = window.google.maps.geometry.encoding.decodePath(
                route.encodedPolyline
              );
              path = decoded.map((p) => ({
                lat: typeof (p as any).lat === "function" ? (p as any).lat() : (p as any).lat,
                lng: typeof (p as any).lng === "function" ? (p as any).lng() : (p as any).lng,
              }));
            } else {
              path = decodePolyline(route.encodedPolyline);
            }
          } else if (
            (route.state === "sea" || route.state === "air") &&
            route.coordinates &&
            !route.error
          ) {
            path = route.coordinates.filter(
              (coord) =>
                coord &&
                typeof coord.lat === "number" &&
                typeof coord.lng === "number" &&
                !isNaN(coord.lat) &&
                !isNaN(coord.lng)
            );
          }

          if (path.length > 1) {
            const options = getRouteColorOptions(route.state);
            const isSelected = selectedRoute === id;

            if (isSelected) {
              options.strokeWeight = (options.strokeWeight || 6) + 3;
              options.strokeOpacity = 1.0;
              options.zIndex = 2000;
              if (route.state === "land") options.strokeColor = "#10b981";
              if (route.state === "sea") options.strokeColor = "#3b82f6";
              if (route.state === "air") options.strokeColor = "#f59e0b";
            } else {
              options.strokeOpacity = 0.7;
              options.zIndex = 1000;
            }

            const polylineConfig: google.maps.PolylineOptions = {
              path,
              geodesic: route.state === "sea" || route.state === "air",
              strokeColor: options.strokeColor,
              strokeOpacity: options.strokeOpacity,
              strokeWeight: options.strokeWeight,
              zIndex: options.zIndex,
            };

            if (options.icons) {
              polylineConfig.icons = options.icons;
            }

            const polyline = new window.google.maps.Polyline(polylineConfig);
            polyline.setMap(mapRef.current!);
            polylineInstancesRef.current.push(polyline);

            const markerSize = isSelected ? 12 : 8;

            const startMarker = new window.google.maps.Marker({
              position: path[0],
              map: mapRef.current!,
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: markerSize,
                fillColor: "#10b981",
                fillOpacity: 0.9,
                strokeWeight: 3,
                strokeColor: "#FFFFFF",
              },
              title: `Start: ${route.origin}`,
              zIndex: isSelected ? 2000 : 1000,
            });
            markersRef.current.push(startMarker);

            const endMarker = new window.google.maps.Marker({
              position: path[path.length - 1],
              map: mapRef.current!,
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: markerSize,
                fillColor: "#ef4444",
                fillOpacity: 0.9,
                strokeWeight: 3,
                strokeColor: "#FFFFFF",
              },
              title: `End: ${route.destination}`,
              zIndex: isSelected ? 2000 : 1000,
            });
            markersRef.current.push(endMarker);
          }
        } catch (err) {
          console.error(`Error creating polyline for route ${id}:`, err);
        }
      });
    }
  }, [routes, isGoogleLoaded, selectedRoute]);

  // Auto-fit map to show all routes when data loads
  useEffect(() => {
    if (
      mapRef.current &&
      Object.keys(routes).length > 0 &&
      isGoogleLoaded
    ) {
      const bounds = new window.google.maps.LatLngBounds();
      let hasValidBounds = false;

      Object.entries(routes).forEach(([id, route]) => {
        try {
          let path: LatLng[] = [];

          if (route.state === "land" && route.encodedPolyline && !route.error) {
            if (window.google?.maps?.geometry?.encoding) {
              const decoded = window.google.maps.geometry.encoding.decodePath(
                route.encodedPolyline
              );
              path = decoded.map((p) => ({
                lat: typeof (p as any).lat === "function" ? (p as any).lat() : (p as any).lat,
                lng: typeof (p as any).lng === "function" ? (p as any).lng() : (p as any).lng,
              }));
            } else {
              path = decodePolyline(route.encodedPolyline);
            }
          } else if (
            (route.state === "sea" || route.state === "air") &&
            route.coordinates &&
            !route.error
          ) {
            path = route.coordinates;
          }

          if (path.length > 0) {
            path.forEach((point) => {
              if (
                point.lat &&
                point.lng &&
                !isNaN(point.lat) &&
                !isNaN(point.lng)
              ) {
                bounds.extend(
                  new window.google.maps.LatLng(point.lat, point.lng)
                );
                hasValidBounds = true;
              }
            });
          }
        } catch (err) {
          console.error(`Error processing route ${id} for initial bounds:`, err);
        }
      });

      if (hasValidBounds) {
        mapRef.current.fitBounds(bounds);
      } else {
        mapRef.current.setCenter({ lat: 20, lng: 0 });
        mapRef.current.setZoom(3);
      }
    }
  }, [routes, isGoogleLoaded]);

  // Cleanup polylines and markers on unmount
  useEffect(() => {
    return () => {
      polylineInstancesRef.current.forEach((polyline) =>
        polyline.setMap(null)
      );
      polylineInstancesRef.current = [];
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
    };
  }, []);

  const handleRouteClick = (routeId: string) => {
    setSelectedRoute(routeId);

    if (mapRef.current && routes[routeId]) {
      const bounds = new window.google.maps.LatLngBounds();
      let pathFound = false;

      try {
        let path: LatLng[] = [];
        const route = routes[routeId];

        if (route.state === "land" && route.encodedPolyline && !route.error) {
          if (window.google?.maps?.geometry?.encoding) {
            const decoded = window.google.maps.geometry.encoding.decodePath(
              route.encodedPolyline
            );
            path = decoded.map((p) => ({
              lat: typeof (p as any).lat === "function" ? (p as any).lat() : (p as any).lat,
              lng: typeof (p as any).lng === "function" ? (p as any).lng() : (p as any).lng,
            }));
          } else {
            path = decodePolyline(route.encodedPolyline);
          }
        } else if (
          (route.state === "sea" || route.state === "air") &&
          route.coordinates &&
          !route.error
        ) {
          path = route.coordinates;
        }

        if (path.length > 0) {
          path.forEach((point) => {
            if (
              point.lat &&
              point.lng &&
              !isNaN(point.lat) &&
              !isNaN(point.lng)
            ) {
              bounds.extend(
                new window.google.maps.LatLng(point.lat, point.lng)
              );
            }
          });
          pathFound = true;
        }

        if (pathFound) {
          mapRef.current!.fitBounds(bounds);
        }
      } catch (err) {
        console.error(`Error fitting bounds for route ${routeId}:`, err);
      }
    }

    setAnimationTrigger(routeId);

    if (isMobile) {
      setShowSidebar(false);
    }
  };

  const getRouteIcon = (state: string): string => {
    switch (state) {
      case "land":
        return "🚛";
      case "sea":
        return "🚢";
      case "air":
        return "✈️";
      default:
        return "📍";
    }
  };

  const getRouteTypeInfo = (routeId: string): RouteTypeInfo => {
    if (!routes[routeId]) return {};

    const routeType = routes[routeId].state;

    const types: Record<string, RouteTypeInfo> = {
      land: {
        color: "from-emerald-500 to-green-600",
        textColor: "text-emerald-800",
        bgColor: "bg-gradient-to-r from-emerald-50 to-green-50",
        borderColor: "border-emerald-200",
        name: "Land Route",
        icon: "🚛",
      },
      sea: {
        color: "from-blue-500 to-cyan-600",
        textColor: "text-blue-800",
        bgColor: "bg-gradient-to-r from-blue-50 to-cyan-50",
        borderColor: "border-blue-200",
        name: "Sea Route",
        icon: "🚢",
      },
      air: {
        color: "from-red-500 to-rose-600",
        textColor: "text-red-800",
        bgColor: "bg-gradient-to-r from-red-50 to-rose-50",
        borderColor: "border-red-200",
        name: "Air Route",
        icon: "✈️",
      },
    };

    return types[routeType] || {};
  };

  const getRouteColorOptions = (
    state: string
  ): google.maps.PolylineOptions & { icons?: google.maps.IconSequence[] } => {
    const baseOptions = {
      clickable: true,
      draggable: false,
      editable: false,
      visible: true,
    };

    switch (state) {
      case "land":
        return {
          ...baseOptions,
          strokeColor: "#059669",
          strokeWeight: 6,
          strokeOpacity: 0.9,
          zIndex: 1000,
        };
      case "sea":
        return {
          ...baseOptions,
          strokeColor: "#0ea5e9",
          strokeWeight: 6,
          strokeOpacity: 0.9,
          geodesic: true,
          zIndex: 1000,
          icons: [
            {
              icon: {
                path: "M 0,-2 0,2",
                strokeOpacity: 1,
                scale: 4,
                strokeColor: "#0369a1",
              },
              offset: "0",
              repeat: "25px",
            },
          ],
        };
      case "air":
        return {
          ...baseOptions,
          strokeColor: "#ef4444",
          strokeWeight: 5,
          strokeOpacity: 0.8,
          geodesic: true,
          zIndex: 1000,
          icons: [
            {
              icon: {
                path: "M 0,-1 0,1",
                strokeOpacity: 1,
                scale: 3,
                strokeColor: "#dc2626",
              },
              offset: "0",
              repeat: "20px",
            },
          ],
        };
      default:
        return {
          ...baseOptions,
          strokeColor: "#6B7280",
          strokeWeight: 3,
          strokeOpacity: 1.0,
          zIndex: 1000,
        };
    }
  };

  const handleBackClick = () => {
    window.close();
  };

  const handleMapStyleChange = (style: string) => {
    setMapStyle(style);
    if (mapRef.current) {
      mapRef.current.setMapTypeId(
        style === "custom"
          ? window.google.maps.MapTypeId.ROADMAP
          : (style as google.maps.MapTypeId)
      );
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-100">
        <div className="text-center p-8 bg-white rounded-xl shadow-md">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto"></div>
          <p className="mt-6 text-slate-700 font-medium">
            Loading routes data...
          </p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-100">
        <div className="text-center p-8 bg-white rounded-xl shadow-md">
          <p className="text-red-600 mb-6 font-medium">
            {(error as any)?.message ?? "Failed to load map data"}
          </p>
          <button
            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 py-3 px-6 rounded-xl transition-colors duration-150 font-medium"
            onClick={handleBackClick}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const customMapStyles: google.maps.MapTypeStyle[] = [
    {
      featureType: "all",
      elementType: "geometry",
      stylers: [{ saturation: -100 }, { lightness: 40 }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#a2d2ff" }, { lightness: 20 }],
    },
    {
      featureType: "landscape",
      elementType: "geometry",
      stylers: [{ color: "#f8fafc" }, { lightness: 20 }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#ffffff" }, { lightness: 30 }],
    },
    {
      featureType: "poi",
      elementType: "geometry",
      stylers: [{ color: "#e2e8f0" }],
    },
    {
      featureType: "administrative",
      elementType: "geometry.stroke",
      stylers: [{ color: "#cbd5e1" }, { weight: 1 }],
    },
  ];

  return (
    <LoadScript
      googleMapsApiKey={MAPS}
      libraries={libraries}
      onLoad={() => setIsGoogleLoaded(true)}
      onError={() => console.error("Google Maps LoadScript error")}
    >
      <div className="flex h-screen bg-slate-100 overflow-hidden relative p-2 sm:p-4">
        {/* Sidebar */}
        <div
          className={`${
            showSidebar
              ? isMobile
                ? "fixed inset-2 z-30 overflow-y-auto"
                : "w-full sm:w-1/3 lg:w-[30%]"
              : isMobile
              ? "hidden"
              : "w-0"
          } bg-white border-r border-gray-200 transition-[width] duration-300 shadow-md h-full rounded-2xl`}
        >
          {showSidebar && (
            <div className="h-full flex flex-col">
              <div className="p-4 sm:p-6 border-b border-slate-200/50">
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-slate-800 to-blue-800 bg-clip-text text-transparent">
                      Route Explorer
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                      Discover cargo routes worldwide
                    </p>
                  </div>
                  {isMobile && (
                    <button
                      className="p-2 rounded-full hover:bg-slate-100 transition-colors duration-200"
                      onClick={() => setShowSidebar(false)}
                    >
                      <svg
                        className="w-5 h-5 sm:w-6 sm:h-6 text-slate-700"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200/50">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  Route Types
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 shadow-sm"></div>
                    <span className="text-xs sm:text-sm font-medium text-slate-700">
                      Land Routes
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-r from-blue-500 to-cyan-600 shadow-sm"></div>
                    <span className="text-xs sm:text-sm font-medium text-slate-700">
                      Sea Routes
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-r from-red-500 to-rose-600 shadow-sm"></div>
                    <span className="text-xs sm:text-sm font-medium text-slate-700">
                      Air Routes
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <h2 className="text-base sm:text-lg font-semibold text-slate-700 mb-4">
                  Available Routes
                </h2>
                <div className="space-y-3">
                  {Object.entries(routes).map(([id, route]) => {
                    const { bgColor, textColor, icon, borderColor, color } =
                      getRouteTypeInfo(id);
                    const isSelected = selectedRoute === id;
                    return (
                      <div
                        key={id}
                        className={`p-3 sm:p-4 rounded-xl cursor-pointer transition-colors duration-150 ${
                          isSelected
                            ? `${bgColor} ${borderColor} border-2 shadow-sm`
                            : "bg-white hover:bg-slate-50 border border-slate-200"
                        }`}
                        onClick={() => handleRouteClick(id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <span className="text-lg sm:text-xl mr-2 sm:mr-3">
                              {icon}
                            </span>
                            <span className="font-semibold text-slate-800 text-sm sm:text-base">
                              {route.name}
                            </span>
                          </div>
                          <div
                            className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${color} text-white shadow-sm`}
                          >
                            {route.state.toUpperCase()}
                          </div>
                        </div>
                        <div className="text-xs sm:text-sm text-slate-600 space-y-1">
                          <div className="flex items-center">
                            <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                            <span className="font-medium">From:</span>{" "}
                            <span className="ml-1">{route.origin}</span>
                          </div>
                          <div className="flex items-center">
                            <span className="w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                            <span className="font-medium">To:</span>{" "}
                            <span className="ml-1">{route.destination}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedRoute && routes[selectedRoute] && (
                <div className="p-4 sm:p-6 border-t border-slate-200/50 bg-gradient-to-r from-slate-50 to-blue-50">
                  <h3 className="font-semibold text-slate-800 mb-3 text-sm sm:text-base">
                    Route Details
                  </h3>
                  <div className="space-y-2 text-xs sm:text-sm text-slate-600">
                    <div className="flex justify-between">
                      <span className="font-medium">Type:</span>
                      <span className="capitalize">
                        {routes[selectedRoute].state}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Origin:</span>
                      <span className="text-right max-w-32 truncate">
                        {routes[selectedRoute].origin}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Destination:</span>
                      <span className="text-right max-w-32 truncate">
                        {routes[selectedRoute].destination}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div
          className={`${
            showSidebar && !isMobile
              ? "w-full sm:w-2/3 lg:w-[70%] ml-2 sm:ml-4"
              : "w-full"
          } transition-[width,margin] duration-300 relative`}
        >
          <div className="h-full bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden relative">
            <button
              className="absolute top-4 sm:top-6 left-4 sm:left-6 z-20 bg-white border border-gray-200 p-2 sm:p-3 rounded-xl shadow-sm hover:bg-gray-50 transition-colors duration-150"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              {showSidebar && !isMobile ? (
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>

            {isMobile &&
              selectedRoute &&
              routes[selectedRoute] &&
              !showSidebar && (
                <div className="absolute top-4 sm:top-6 left-16 sm:left-20 right-4 sm:right-6 z-10 bg-white border border-gray-200 rounded-xl shadow-md py-2 sm:py-3 px-3 sm:px-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-base sm:text-lg mr-1 sm:mr-2">
                      {getRouteIcon(routes[selectedRoute].state)}
                    </span>
                    <span className="font-semibold text-xs sm:text-sm truncate max-w-24 sm:max-w-32">
                      {routes[selectedRoute].name}
                    </span>
                  </div>
                  <div
                    className={`ml-2 px-1 sm:px-2 py-0.5 sm:py-1 rounded-lg text-xs font-semibold bg-gradient-to-r ${
                      getRouteTypeInfo(selectedRoute).color
                    } text-white`}
                  >
                    {routes[selectedRoute].state.toUpperCase()}
                  </div>
                </div>
              )}

            <div className="absolute bottom-16 sm:bottom-20 left-1/2 transform -translate-x-1/2 z-10 flex space-x-2 sm:space-x-3">
              {["custom", "roadmap", "satellite", "terrain"].map((style) => (
                <button
                  key={style}
                  className={`${
                    mapStyle === style
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-700 hover:bg-slate-100 border border-gray-200"
                  } py-1 sm:py-2 px-3 sm:px-4 rounded-xl shadow-sm transition-colors duration-150 text-xs sm:text-sm capitalize font-medium`}
                  onClick={() => handleMapStyleChange(style)}
                >
                  {style === "custom" ? "Modern" : style}
                </button>
              ))}
            </div>

            <button
              className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-10 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 py-2 sm:py-3 px-4 sm:px-6 rounded-xl shadow-sm transition-colors duration-150"
              onClick={handleBackClick}
            >
              <span className="text-gray-800 font-semibold flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <svg
                  className="w-3 h-3 sm:w-4 sm:h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Close
              </span>
            </button>

            {isGoogleLoaded ? (
              <GoogleMap
                mapContainerStyle={{ width: "100%", height: "100%" }}
                center={mapCenter}
                zoom={mapZoom}
                options={{
                  styles: mapStyle === "custom" ? customMapStyles : [],
                  zoomControl: true,
                  mapTypeControl: false,
                  streetViewControl: false,
                  fullscreenControl: true,
                  minZoom: 2,
                  maxZoom: 15,
                  restriction: {
                    latLngBounds: {
                      north: 85,
                      south: -85,
                      west: -180,
                      east: 180,
                    },
                  },
                }}
                onLoad={(map) => {
                  mapRef.current = map;
                }}
              >
                {/* Route polylines — animated vehicles */}
                {isGoogleLoaded &&
                  window.google?.maps &&
                  Object.entries(routes).map(([id, route]) => {
                    if (route.error) return null;

                    let path: LatLng[] = [];

                    if (route.state === "land" && route.encodedPolyline) {
                      try {
                        if (
                          window.google?.maps?.geometry?.encoding
                        ) {
                          const decoded =
                            window.google.maps.geometry.encoding.decodePath(
                              route.encodedPolyline
                            );
                          path = decoded.map((p) => ({
                            lat: typeof (p as any).lat === "function" ? (p as any).lat() : (p as any).lat,
                            lng: typeof (p as any).lng === "function" ? (p as any).lng() : (p as any).lng,
                          }));
                        } else {
                          path = decodePolyline(route.encodedPolyline);
                        }
                      } catch {
                        return null;
                      }
                    } else if (
                      (route.state === "sea" || route.state === "air") &&
                      route.coordinates &&
                      Array.isArray(route.coordinates)
                    ) {
                      path = route.coordinates.filter(
                        (coord) =>
                          coord &&
                          typeof coord.lat === "number" &&
                          typeof coord.lng === "number" &&
                          !isNaN(coord.lat) &&
                          !isNaN(coord.lng)
                      );
                    }

                    if (path.length > 1) {
                      return (
                        <React.Fragment key={id}>
                          <AnimatedVehicle
                            path={path}
                            routeType={route.state}
                            shouldAnimate={animationTrigger === id}
                          />
                        </React.Fragment>
                      );
                    }
                    return null;
                  })}

                {/* Start and end markers */}
                {isGoogleLoaded &&
                  Object.entries(routes).flatMap(([id, route]) => {
                    const isSelected = selectedRoute === id;
                    const markerColor =
                      route.state === "land"
                        ? "#059669"
                        : route.state === "sea"
                        ? "#0ea5e9"
                        : "#ef4444";

                    let path: LatLng[] = [];

                    if (route.encodedPolyline && !route.error) {
                      try {
                        if (
                          window.google?.maps?.geometry?.encoding
                        ) {
                          const decoded =
                            window.google.maps.geometry.encoding.decodePath(
                              route.encodedPolyline
                            );
                          path = decoded.map((p) => ({
                            lat: typeof (p as any).lat === "function" ? (p as any).lat() : (p as any).lat,
                            lng: typeof (p as any).lng === "function" ? (p as any).lng() : (p as any).lng,
                          }));
                        } else {
                          path = decodePolyline(route.encodedPolyline);
                        }
                      } catch {
                        // ignore
                      }
                    } else if (
                      route.coordinates &&
                      Array.isArray(route.coordinates) &&
                      !route.error
                    ) {
                      path = route.coordinates.filter(
                        (coord) =>
                          coord &&
                          typeof coord.lat === "number" &&
                          typeof coord.lng === "number" &&
                          !isNaN(coord.lat) &&
                          !isNaN(coord.lng)
                      );
                    }

                    if (path.length > 1) {
                      return [
                        <Marker
                          key={`${id}-start`}
                          position={path[0]}
                          icon={{
                            path: window.google.maps.SymbolPath.CIRCLE,
                            scale: isSelected ? 12 : 8,
                            fillColor: markerColor,
                            fillOpacity: 0.9,
                            strokeWeight: 3,
                            strokeColor: "#FFFFFF",
                          }}
                          onClick={() => setActiveMarker(`${id}-start`)}
                        >
                          {activeMarker === `${id}-start` && (
                            <InfoWindow
                              onCloseClick={() => setActiveMarker(null)}
                            >
                              <div className="p-2">
                                <p className="font-semibold text-slate-800 text-xs sm:text-sm">
                                  {route.origin}
                                </p>
                                <p className="text-xs text-slate-600">
                                  Starting point
                                </p>
                              </div>
                            </InfoWindow>
                          )}
                        </Marker>,
                        <Marker
                          key={`${id}-end`}
                          position={path[path.length - 1]}
                          icon={{
                            path: window.google.maps.SymbolPath.CIRCLE,
                            scale: isSelected ? 12 : 8,
                            fillColor: markerColor,
                            fillOpacity: 0.9,
                            strokeWeight: 3,
                            strokeColor: "#FFFFFF",
                          }}
                          onClick={() => setActiveMarker(`${id}-end`)}
                        >
                          {activeMarker === `${id}-end` && (
                            <InfoWindow
                              onCloseClick={() => setActiveMarker(null)}
                            >
                              <div className="p-2">
                                <p className="font-semibold text-slate-800 text-xs sm:text-sm">
                                  {route.destination}
                                </p>
                                <p className="text-xs text-slate-600">
                                  Destination point
                                </p>
                              </div>
                            </InfoWindow>
                          )}
                        </Marker>,
                      ];
                    }
                    return [];
                  })}
              </GoogleMap>
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <div className="text-center p-8 bg-white rounded-xl shadow-md">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto"></div>
                  <p className="mt-6 text-slate-700 font-medium">
                    Loading Google Maps...
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </LoadScript>
  );
}

export default RouteMap;
