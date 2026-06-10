import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/index.css";
import App from "./App";
import ChatbotDrawer from "./components/ChatbotDrawer";
import { TrpcProvider } from "./lib/trpcProvider";

const rootElement = document.getElementById("root") as HTMLElement;

createRoot(rootElement).render(
  <StrictMode>
    <TrpcProvider>
      <App />
      <ChatbotDrawer />
    </TrpcProvider>
  </StrictMode>
);
