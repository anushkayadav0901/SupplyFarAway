import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { trpc } from "../lib/trpc";

const ProtectedRoute = () => {
  const { data, isLoading, isError } = trpc.auth.getMe.useQuery(undefined, {
    retry: false,
  });

  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-[var(--color-neutral-100)] animate-pulse"
        aria-label="Loading"
        role="status"
      />
    );
  }

  const isAuthenticated = !!data && !isError;

  return isAuthenticated ? <Outlet /> : <Navigate to="/" />;
};

export default ProtectedRoute;
