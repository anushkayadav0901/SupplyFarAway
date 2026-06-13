import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import GoogleLogin from "./GoogleLogin";
import Toast from "../../components/Toast";
import FeatureCard from "./FeatureCard";
import { FaCheckCircle, FaTruck, FaBox } from "react-icons/fa";
import { trpc } from "../../lib/trpc";

interface ToastState {
  type: string;
  message: string;
}

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

  const features = [
    {
      icon: <FaCheckCircle className="text-emerald-600" size={18} />,
      title: "Compliance Monitoring",
      desc: "Automated checks for global trade rules",
      gradient: "bg-emerald-50/50 border-emerald-200/50",
      iconBg: "bg-emerald-100/70",
      iconColor: "text-emerald-600",
    },
    {
      icon: <FaTruck className="text-blue-600" size={18} />,
      title: "Smart Route Optimization",
      desc: "Best routes by cost, time, and emissions",
      gradient: "bg-blue-50/50 border-blue-200/50",
      iconBg: "bg-blue-100/70",
      iconColor: "text-blue-600",
    },
    {
      icon: <FaBox className="text-amber-600" size={18} />,
      title: "Inventory Management",
      desc: "Track all shipments & records in one place",
      gradient: "bg-amber-50/50 border-amber-200/50",
      iconBg: "bg-amber-100/70",
      iconColor: "text-amber-600",
    },
  ];

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      localStorage.setItem("token", token);
      setToastProps({ type: "success", message: "Google Login Successful!" });
      const nextPath = searchParams.get("next") || "/dashboard";
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

  const handleLogin = () => {
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
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      {/* Left Side - Light Mode Structured Layout */}
      <motion.div
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
        className="hidden lg:flex lg:w-2/3 lg:h-[calc(100vh-40px)] lg:m-5 bg-slate-50 relative overflow-hidden rounded-3xl border border-slate-200"
      >
        {/* Subtle grid background */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="black" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Content Container */}
        <div className="absolute inset-0 flex flex-col justify-between p-12">
          <div>
            <h1 className="text-5xl font-bold text-slate-900 mb-2 tracking-tight">
              <span className="text-blue-600">
                Supply Chain
              </span>
            </h1>
            <p className="text-lg text-slate-600 font-medium">
              Shipment routing, compliance, and verification tools
            </p>
          </div>

          {/* Feature Cards */}
          <div className="flex flex-col gap-4 w-full max-w-lg">
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                {...feature}
                index={index}
              />
            ))}
          </div>

          <div>
            <p className="text-slate-400 text-xs tracking-wider uppercase font-semibold">
              Verifiable Logistics Platform
            </p>
          </div>
        </div>
      </motion.div>

      {/* Right Side - Login Form */}
      <div
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

              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3.5 rounded-xl font-semibold transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-0 shadow-sm"
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
              </button>

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
      </div>
      <Toast type={toastProps.type} message={toastProps.message} />
    </div>
  );
};

export default Login;
