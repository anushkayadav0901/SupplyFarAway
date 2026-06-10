import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { trpc } from "../lib/trpc";

const ProtectedRoute = () => {
  const { data, isLoading, isError } = trpc.auth.getMe.useQuery(undefined, {
    retry: false,
  });

  if (isLoading) return null;

  const isAuthenticated = !!data && !isError;

  return isAuthenticated ? <Outlet /> : <Navigate to="/" />;
};

export default ProtectedRoute;
