import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import GoogleLogin from "./GoogleLogin";
import Globe from "react-globe.gl";
import Toast from "../../components/Toast";
import TypewriterText from "./TypewriterText";
import FeatureCard from "./FeatureCard";
import { FaCheckCircle, FaTruck, FaBox } from "react-icons/fa";
import { trpc } from "../../lib/trpc";

interface Hub {
  lat: number;
  lng: number;
  city: string;
  size: number;
  color: string;
}

interface Route {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
}

interface LogisticsData {
  hubs: Hub[];
  routes: Route[];
}

interface ToastState {
  type: string;
  message: string;
}

interface FloatingLabelProps {
  label: string;
  value: string;
  focused: boolean;
  children: React.ReactNode;
}

// Move LogisticsGlobe outside and memoize it
const LogisticsGlobe = React.memo(() => {
  const globeEl = useRef<any>(null);
  const [globeReady, setGlobeReady] = useState(false);

  // Memoize logistics data to prevent recreation
  const logisticsData = useMemo<LogisticsData>(
    () => ({
      hubs: [
        // North America
        {
          lat: 40.7128,
          lng: -74.006,
          city: "New York",
          size: 1.2,
          color: "#60a5fa",
        },
        {
          lat: 19.4326,
          lng: -99.1332,
          city: "Mexico City",
          size: 1.1,
          color: "#fbbf24",
        },
        // South America
        {
          lat: -23.5505,
          lng: -46.6333,
          city: "Sao Paulo",
          size: 1.1,
          color: "#f97316",
        },
        // Europe
        {
          lat: 51.5074,
          lng: -0.1278,
          city: "London",
          size: 1.2,
          color: "#34d399",
        },
        {
          lat: 55.7558,
          lng: 37.6173,
          city: "Moscow",
          size: 1.0,
          color: "#818cf8",
        },
        // Africa
        {
          lat: -33.9249,
          lng: 18.4241,
          city: "Cape Town",
          size: 1.0,
          color: "#22d3ee",
        },
        // Middle East
        {
          lat: 25.2048,
          lng: 55.2708,
          city: "Dubai",
          size: 1.1,
          color: "#fb7185",
        },
        // South Asia
        {
          lat: 19.076,
          lng: 72.8777,
          city: "Mumbai",
          size: 1.1,
          color: "#4ade80",
        },
        // East Asia
        {
          lat: 35.6895,
          lng: 139.6917,
          city: "Tokyo",
          size: 1.3,
          color: "#fbbf24",
        },
        // Southeast Asia
        {
          lat: 1.3521,
          lng: 103.8198,
          city: "Singapore",
          size: 1.2,
          color: "#a78bfa",
        },
        // Oceania
        {
          lat: -33.8688,
          lng: 151.2093,
          city: "Sydney",
          size: 1.1,
          color: "#10b981",
        },
        // Central Asia
        {
          lat: 43.222,
          lng: 76.8512,
          city: "Almaty",
          size: 1.0,
          color: "#eab308",
        },
        // North Africa
        {
          lat: 30.0444,
          lng: 31.2357,
          city: "Cairo",
          size: 1.0,
          color: "#ef4444",
        },
      ],

      routes: [
        // Inter-continental and major connections
        // North America <-> Europe <-> Asia
        {
          startLat: 40.7128,
          startLng: -74.006,
          endLat: 51.5074,
          endLng: -0.1278,
        }, // New York - London
        {
          startLat: 51.5074,
          startLng: -0.1278,
          endLat: 55.7558,
          endLng: 37.6173,
        }, // London - Moscow
        {
          startLat: 55.7558,
          startLng: 37.6173,
          endLat: 43.222,
          endLng: 76.8512,
        }, // Moscow - Almaty
        {
          startLat: 43.222,
          startLng: 76.8512,
          endLat: 35.6895,
          endLng: 139.6917,
        }, // Almaty - Tokyo
        {
          startLat: 35.6895,
          startLng: 139.6917,
          endLat: 1.3521,
          endLng: 103.8198,
        }, // Tokyo - Singapore
        {
          startLat: 1.3521,
          startLng: 103.8198,
          endLat: -33.8688,
          endLng: 151.2093,
        }, // Singapore - Sydney
        {
          startLat: -33.8688,
          startLng: 151.2093,
          endLat: 19.076,
          endLng: 72.8777,
        }, // Sydney - Mumbai
        {
          startLat: 19.076,
          startLng: 72.8777,
          endLat: 25.2048,
          endLng: 55.2708,
        }, // Mumbai - Dubai
        {
          startLat: 25.2048,
          startLng: 55.2708,
          endLat: 30.0444,
          endLng: 31.2357,
        }, // Dubai - Cairo
        {
          startLat: 30.0444,
          startLng: 31.2357,
          endLat: -33.9249,
          endLng: 18.4241,
        }, // Cairo - Cape Town
        {
          startLat: -33.9249,
          startLng: 18.4241,
          endLat: -23.5505,
          endLng: -46.6333,
        }, // Cape Town - Sao Paulo
        {
          startLat: -23.5505,
          startLng: -46.6333,
          endLat: 19.4326,
          endLng: -99.1332,
        }, // Sao Paulo - Mexico City
        {
          startLat: 19.4326,
          startLng: -99.1332,
          endLat: 40.7128,
          endLng: -74.006,
        }, // Mexico City - New York

        // Additional cross-connections for network robustness
        {
          startLat: 40.7128,
          startLng: -74.006,
          endLat: 19.4326,
          endLng: -99.1332,
        }, // New York - Mexico City
        {
          startLat: 51.5074,
          startLng: -0.1278,
          endLat: 30.0444,
          endLng: 31.2357,
        }, // London - Cairo
        {
          startLat: 1.3521,
          startLng: 103.8198,
          endLat: 25.2048,
          endLng: 55.2708,
        }, // Singapore - Dubai
        {
          startLat: 19.076,
          startLng: 72.8777,
          endLat: 43.222,
          endLng: 76.8512,
        }, // Mumbai - Almaty
        {
          startLat: -33.9249,
          startLng: 18.4241,
          endLat: 51.5074,
          endLng: -0.1278,
        }, // Cape Town - London
      ],
    }),
    []
  );

  // Add proper dependency array to useEffect
  useEffect(() => {
    if (globeEl.current && !globeReady) {
      const controls = globeEl.current.controls();
      controls.autoRotate = false;
      controls.enableZoom = false;

      // Set initial camera position — centered on the Americas
      globeEl.current.pointOfView({ lat: 20, lng: -80, altitude: 1.8 }, 0);

      // Lock vertical rotation
      const currentPolar = controls.getPolarAngle();
      controls.minPolarAngle = currentPolar;
      controls.maxPolarAngle = currentPolar;

      setGlobeReady(true);
    }
  }, [globeReady]); // Only run when globeReady changes

  return (
    <div className="w-full h-full relative">
      <Globe
        ref={globeEl}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundColor="rgba(0,0,0,0)"
        pointsData={logisticsData.hubs}
        pointLat="lat"
        pointLng="lng"
        pointAltitude={(d: any) => (d as Hub).size * 0.03}
        pointRadius={(d: any) => (d as Hub).size * 1.2}
        pointColor={(d: any) => (d as Hub).color}
        pointsMerge={true}
        arcsData={logisticsData.routes}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor={() => ["#60a5fa", "#34d399", "#fbbf24"]}
        arcAltitude={0.3}
        arcStroke={0.8}
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashInitialGap={() => Math.random()}
        arcDashAnimateTime={() => Math.random() * 2000 + 1000}
        arcsTransitionDuration={0}
        ringsData={logisticsData.hubs}
        ringLat="lat"
        ringLng="lng"
        ringMaxRadius={(d: any) => (d as Hub).size * 3}
        ringPropagationSpeed={2}
        ringRepeatPeriod={800}
        ringColor={(d: any) => (d as Hub).color}
        labelsData={logisticsData.hubs}
        labelLat="lat"
        labelLng="lng"
        labelText="city"
        labelSize={2}
        labelDotRadius={0.5}
        labelColor={() => "#ffffff"}
        labelResolution={2}
      />
    </div>
  );
});

const Login = () => {
  const [emailAddress, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [toastProps, setToastProps] = useState<ToastState>({ type: "", message: "" });

  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
    };
  }, []);

  // tRPC mutation for login
  const loginMutation = trpc.auth.loginUser.useMutation({
    onSuccess: (data: { token: string; [key: string]: unknown }) => {
      localStorage.setItem("token", data.token);
      setToastProps({ type: "success", message: "Login Successful!" });
      const nextPath = searchParams.get("next") || "/dashboard";
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
      navTimerRef.current = setTimeout(() => {
        navigate(nextPath);
      }, 1000);
    },
    onError: (error: { message: string }) => {
      setToastProps({
        type: "error",
        message: error.message || "Login failed",
      });
    },
  });

  const loading = loginMutation.isPending;

  // Memoize features array to prevent recreation
  const features = useMemo(
    () => [
      {
        icon: <FaCheckCircle className="text-emerald-400" size={18} />,
        title: "Compliance Monitoring",
        desc: "Automated checks for global trade rules",
        gradient: "bg-emerald-500/10",
        iconBg: "bg-emerald-500/10",
      },
      {
        icon: <FaTruck className="text-blue-400" size={18} />,
        title: "Smart Route Optimization",
        desc: "Best routes by cost, time, and emissions",
        gradient: "bg-blue-500/10",
        iconBg: "bg-blue-500/10",
      },
      {
        icon: <FaBox className="text-yellow-400" size={18} />,
        title: "Inventory Management",
        desc: "Track all shipments & records in one place",
        gradient: "bg-yellow-500/10",
        iconBg: "bg-yellow-500/10",
      },
    ],
    []
  );

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      localStorage.setItem("token", token);
      setToastProps({ type: "success", message: "Google Login Successful!" });
      const nextPath = searchParams.get("next") || "/dashboard";
      // Strip the token from the URL so a refresh doesn't re-trigger this
      // path with a stale token in the address bar.
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("token");
        window.history.replaceState({}, "", url.toString());
      } catch {
        // ignore — non-fatal
      }
      const timer = setTimeout(() => {
        navigate(nextPath);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [searchParams, navigate]);

  // Validate email format
  const isValidEmail = (email: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Memoize handleLogin to prevent recreation
  const handleLogin = useCallback(() => {
    // Guard against double-submit via Enter key while a mutation is pending.
    if (loginMutation.isPending) return;
    if (!emailAddress || !password) {
      setToastProps({ type: "warn", message: "Please fill in all fields" });
      return;
    }
    if (!isValidEmail(emailAddress)) {
      setToastProps({ type: "warn", message: "Please enter a valid email address" });
      return;
    }
    if (password.length < 1) {
      setToastProps({ type: "warn", message: "Please enter your password" });
      return;
    }

    loginMutation.mutate({ emailAddress, password });
  }, [emailAddress, password, loginMutation]);

  const FloatingLabel = ({ label, value, focused, children }: FloatingLabelProps) => (
    <div className="relative">
      <motion.label
        animate={{
          y: focused || value ? -24 : 0,
          scale: focused || value ? 0.85 : 1,
          color: focused ? "#c7a711" : "#ffffff80",
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="absolute left-4 top-4 text-white/50 pointer-events-none origin-left z-10 font-medium"
      >
        {label}
      </motion.label>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center">
      {/* Left Side - Enhanced Globe Visualization */}
      <motion.div
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
        className="hidden lg:flex lg:w-2/3 lg:h-[calc(100vh-40px)] lg:m-5 bg-slate-900 relative overflow-hidden rounded-3xl border border-white/20"
      >
        <div className="absolute inset-0 opacity-20">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 25% 25%, rgba(96,165,250,0.3) 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
            }}
          ></div>
        </div>

        {/* Floating geometric shapes */}
        <div className="absolute inset-0">
          {[...Array(2)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border border-white/12"
              style={{
                width: `${150 + i * 100}px`,
                height: `${150 + i * 100}px`,
                right: `${-75 + i * 20}px`,
                top: `${-75 + i * 30}px`,
              }}
              animate={{
                rotate: [0, 360],
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 25 + i * 5,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          ))}
        </div>

        {/* Globe Container */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.5 }}
            className="absolute inset-0"
          >
            <LogisticsGlobe />
          </motion.div>

          {/* Bottom tagline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1.5 }}
            className="absolute bottom-8 left-1/4 text-center z-20"
          >
            <p className="text-white/80 text-sm">
              Experience logistics visualization powered by AI
            </p>
          </motion.div>
        </div>

        {/* Content Container */}
        <div className="absolute right-0 top-20 w-1/2 h-full flex flex-col justify-between p-8">
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="z-20"
          >
             <h1 className="text-5xl font-bold text-white mb-2 tracking-tight drop-shadow-lg">
              <span className="text-blue-300">
                Supply Chain
              </span>
            </h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-lg text-white/90 font-medium"
            >
              <TypewriterText
                text={"Connect the World, Deliver the Future"}
                delay={1000}
                speed={40}
              />
            </motion.p>
            {/* Feature Cards */}
            <div className="flex flex-col gap-4 mt-16 w-full max-w-lg">
              {features.map((feature, index) => (
                <FeatureCard
                  key={index}
                  {...feature}
                  index={index}
                  animationDelay={0.2}
                  titleDelay={500 + index * 200}
                  descDelay={1000 + index * 200}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Right Side - Login Form */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full lg:w-1/3 flex items-center justify-center p-6"
      >
        <div className="w-full max-w-md bg-neutral-50 rounded-custom shadow-custom-medium p-8">
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-3xl font-bold text-center text-tertiary-500 mb-2"
            >
              Welcome Back
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-center text-neutral-600 mb-8"
            >
              Log in to Supply Chain
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="space-y-6"
            >
              <div className="relative">
                <label htmlFor="login-email" className="sr-only">Email Address</label>
                <input
                  id="login-email"
                  type="email"
                  placeholder="Email Address"
                  value={emailAddress}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  disabled={loading}
                  autoComplete="email"
                  className="w-full px-4 py-3 pl-10 border border-neutral-300 rounded-xl text-neutral-700 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                  />
                </svg>
              </div>

              {/* Password Input */}
              <div className="relative">
                <label htmlFor="login-password" className="sr-only">Password</label>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  disabled={loading}
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pl-10 border border-neutral-300 rounded-xl text-neutral-700 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V9a4 4 0 00-8 0v2h8z"
                  />
                </svg>
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  {showPassword ? (
                    // Eye icon
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  ) : (
                    // Eye slash icon
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  )}
                </button>
              </div>

              <motion.button
                whileHover={{ scale: loading ? 1 : 1.03 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-semibold transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-0 shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Signing In...
                  </>
                ) : (
                  "Sign In"
                )}
              </motion.button>

              <div className="relative flex items-center justify-center my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-300"></div>
                </div>
                <div className="relative bg-neutral-50 px-4 text-neutral-600 text-sm">
                  OR
                </div>
              </div>

              <GoogleLogin />

              <div className="text-center">
                <Link
                  to="/createAccount"
                  className="text-secondary-500 hover:text-secondary-600 hover:underline transition-colors"
                >
                  Don't have an account? Sign up
                </Link>
              </div>
            </motion.div>
          </div>
      </motion.div>
      <Toast type={toastProps.type} message={toastProps.message} />
    </div>
  );
};

export default Login;

