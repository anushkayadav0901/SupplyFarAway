import React, { useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type ToastType = "success" | "error" | "info" | "warning" | string;

interface ToastProps {
  type: ToastType;
  message: string;
}

const Toast = ({ type, message }: ToastProps) => {
  useEffect(() => {
    if (!message) return;

    const toastOptions = {
      position: "top-right" as const,
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: "light" as const,
      style: { maxWidth: "500px" },
    };

    switch (type) {
      case "success":
        toast.success(message, toastOptions);
        break;
      case "error":
        toast.error(message, toastOptions);
        break;
      case "info":
        toast.info(message, toastOptions);
        break;
      // Accept both "warning" and the shorter "warn" alias — callers
      // throughout the codebase use either spelling.
      case "warning":
      case "warn":
        toast.warn(message, toastOptions);
        break;
      default:
        toast(message, toastOptions);
        break;
    }
  }, [type, message]);

  return (
    <ToastContainer
      position="top-right"
      autoClose={5000}
      hideProgressBar={false}
      newestOnTop={false}
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="light"
      style={{ width: "auto", maxWidth: "500px" }}
      className="toast-container"
    />
  );
};

export default Toast;
