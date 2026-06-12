import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/index.css";
import App, { ErrorBoundary } from "./App";
import ChatbotDrawer from "./components/ChatbotDrawer";
import { TrpcProvider } from "./lib/trpcProvider";

const rootElement = document.getElementById("root") as HTMLElement;

// Wrap the entire tree in ErrorBoundary so uncaught render errors never
// produce a blank page — they fall back to the AlertTriangle UI.
createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <TrpcProvider>
        <App />
        <ChatbotDrawer />
      </TrpcProvider>
    </ErrorBoundary>
  </StrictMode>
);
