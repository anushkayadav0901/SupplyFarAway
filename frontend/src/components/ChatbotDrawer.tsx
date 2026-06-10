import React, { useEffect, useState, useCallback } from "react";

const SupplyChainChatbot = React.memo(() => {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadScript = useCallback(() => {
    if (window.customElements.get("df-messenger")) {
      setIsScriptLoaded(true);
      setIsLoading(false);
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://www.gstatic.com/dialogflow-console/fast/df-messenger/prod/v1/df-messenger.js";
    script.async = true;
    script.onload = () => {
      window.customElements.whenDefined("df-messenger").then(() => {
        setIsScriptLoaded(true);
        setIsLoading(false);
      });
    };
    script.onerror = () => {
      setError("Failed to load SupplyChain Assistant. Please try again later.");
      setIsLoading(false);
    };
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(loadScript, 100);
    return () => clearTimeout(timeoutId);
  }, [loadScript]);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://www.gstatic.com/dialogflow-console/fast/df-messenger/prod/v1/themes/df-messenger-default.css"
      />
      {isLoading && (
        <div className="chatbot-loading">
          <div className="spinner"></div>
          <p>Loading SupplyChain Assistant...</p>
        </div>
      )}
      {error && (
        <div className="chatbot-error">
          <p>{error}</p>
          <button
            onClick={() => {
              setError(null);
              setIsLoading(true);
              loadScript();
            }}
            className="retry-button"
          >
            Retry
          </button>
        </div>
      )}
      {isScriptLoaded && !error && (
        <df-messenger
          project-id="supplychain-462215"
          agent-id="7032bfd8-4e8c-45b8-9ef0-b888e4667f6f"
          language-code="en"
          max-query-length="-1"
          allow-feedback="false"
          payload-text-visible="false"
        >
          <df-messenger-chat-bubble chat-title="SupplyChain Assistant"></df-messenger-chat-bubble>
        </df-messenger>
      )}
      <style>{`
        df-messenger {
          --df-messenger-font-family: 'Poppins', 'Inter', 'Segoe UI', 'Roboto', 'Arial', sans-serif;
          --df-messenger-font-color: #1e293b;
          --df-messenger-chat-background: #f8fafc;
          --df-messenger-message-user-background: #4f46e5;
          --df-messenger-message-user-font-color: #fff;
          --df-messenger-message-bot-background: #ffffff;
          --df-messenger-message-bot-font-color: #1e293b;
          --df-messenger-input-box-background: #ffffff;
          --df-messenger-input-box-font-color: #1e293b;
          --df-messenger-send-icon: #4f46e5;
          --df-messenger-primary-color: #4f46e5;
          --df-messenger-border-radius: 24px;
          --df-messenger-chat-bubble-background: #4f46e5;
          --df-messenger-chat-bubble-font-color: #fff;
          --df-messenger-chat-bubble-border-radius: 24px;
          --df-messenger-min-width: 400px;
          --df-messenger-max-width: 440px;
          --df-messenger-box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
          z-index: 999;
          position: fixed;
          bottom: 32px;
          right: 32px;
          border-radius: 24px;
          transition: transform 0.2s ease-out, opacity 0.2s ease-out;
        }

        df-messenger::part(drawer) {
          border-radius: 24px;
          background: #ffffff;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          transition: transform 0.2s ease-out, opacity 0.2s ease-out;
          transform-origin: bottom right;
          visibility: visible;
          border: 1px solid #e2e8f0;
        }

        df-messenger::part(drawer[open]) {
          transform: scale(1);
          opacity: 1;
        }

        df-messenger::part(drawer:not([open])) {
          transform: scale(0.95);
          opacity: 0;
          visibility: hidden;
          transition: transform 0.15s ease-in, opacity 0.15s ease-in;
        }

        df-messenger::part(chat-title) {
          background: #4f46e5;
          color: #ffffff;
          font-family: 'Poppins', 'Inter', 'Segoe UI', sans-serif;
          font-weight: 700;
          font-size: 18px;
          letter-spacing: 0.5px;
          padding: 24px 20px;
          border-radius: 22px 22px 0 0;
          text-align: center;
        }

        df-messenger::part(send-button) {
          background: #4f46e5;
          border-radius: 50%;
          transition: transform 0.15s ease, background-color 0.15s ease;
          box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
          width: 48px;
          height: 48px;
        }

        df-messenger::part(send-button):hover {
          background: #4338ca;
          transform: scale(1.05);
        }

        df-messenger::part(input-box) {
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          padding: 12px 20px;
          background: #ffffff;
        }

        df-messenger::part(input-box):focus {
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
        }

        df-messenger::part(message-list) {
          background: #f8fafc;
          padding: 16px;
        }

        df-messenger::part(message-bot) {
          background: #ffffff;
          border-left: 3px solid #4f46e5;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
          border-radius: 20px 20px 20px 4px;
          margin: 12px 0;
        }

        df-messenger::part(message-user) {
          background: #4f46e5;
          box-shadow: 0 2px 8px rgba(79, 70, 229, 0.2);
          border-radius: 20px 20px 4px 20px;
          margin: 12px 0;
        }

        df-messenger::part(chat-bubble) {
          background: #4f46e5;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
          border-radius: 24px;
          transition: transform 0.15s ease;
        }

        df-messenger::part(chat-bubble):hover {
          transform: scale(1.03);
        }

        /* Hide payload messages */
        df-messenger::part(message-payload),
        df-messenger::part(payload-content) {
          display: none !important;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 768px) {
          df-messenger {
            --df-messenger-min-width: 90vw;
            --df-messenger-max-width: 95vw;
            right: 2.5vw;
            bottom: 2.5vw;
          }
        }

        /* Loading and error states */
        .chatbot-loading {
          position: fixed;
          bottom: 32px;
          right: 32px;
          background: #ffffff;
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
          display: flex;
          align-items: center;
          gap: 12px;
          z-index: 998;
          border: 1px solid #e2e8f0;
          max-width: calc(100vw - 20px);
        }

        @media (max-width: 400px) {
          .chatbot-loading {
            right: 10px;
          }
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid #4f46e5;
          border-top: 3px solid transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          flex-shrink: 0;
        }

        .chatbot-error {
          position: fixed;
          bottom: 32px;
          right: 32px;
          background: #ffffff;
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
          border: 1px solid #e2e8f0;
          color: #1e293b;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          z-index: 998;
          max-width: calc(100vw - 20px);
        }

        @media (max-width: 400px) {
          .chatbot-error {
            right: 10px;
          }
        }

        .retry-button {
          background: #4f46e5;
          color: #fff;
          border: none;
          border-radius: 20px;
          padding: 8px 16px;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .retry-button:hover {
          background: #4338ca;
        }
      `}</style>
    </>
  );
});

SupplyChainChatbot.displayName = "SupplyChainChatbot";

export default SupplyChainChatbot;
