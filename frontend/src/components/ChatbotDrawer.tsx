import React, { useEffect, useCallback, useRef, useState } from "react";

// Extend JSX to accept df-messenger custom elements without TS errors.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "df-messenger": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          "project-id"?: string;
          "agent-id"?: string;
          "language-code"?: string;
          "max-query-length"?: string;
          "allow-feedback"?: string;
          "payload-text-visible"?: string;
        },
        HTMLElement
      >;
      "df-messenger-chat-bubble": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { "chat-title"?: string },
        HTMLElement
      >;
    }
  }
}

// ─── constants ───────────────────────────────────────────────
const SCRIPT_SRC =
  "https://www.gstatic.com/dialogflow-console/fast/df-messenger/prod/v1/df-messenger.js";
const THEME_HREF =
  "https://www.gstatic.com/dialogflow-console/fast/df-messenger/prod/v1/themes/df-messenger-default.css";
const SCRIPT_LOAD_DELAY_MS = 100;

// ─── SupplyChainChatbot ───────────────────────────────────────
/**
 * Renders the Dialogflow df-messenger widget.
 *
 * Accessibility notes:
 *  - The df-messenger widget manages its own drawer DOM; we cannot inject
 *    a focus-trap into the shadow DOM without brittle hacks.
 *  - We DO: handle Escape to close via the widget's custom event/API,
 *    provide a labelled wrapper region, and keep retry accessible.
 *  - aria-live="polite" on the status region announces load / error.
 *
 * V4: the script element is appended once and cleaned up on unmount only
 *   when the component is actually removed (not on re-renders).
 *   setTimeout is cleared in the cleanup.
 */
const SupplyChainChatbot = React.memo(() => {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // V4: track mount state so async callbacks don't set state after unmount.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadScript = useCallback(() => {
    // If already registered, skip injection.
    if (window.customElements.get("df-messenger")) {
      if (mountedRef.current) {
        setIsScriptLoaded(true);
        setIsLoading(false);
      }
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;

    script.onload = () => {
      window.customElements.whenDefined("df-messenger").then(() => {
        if (mountedRef.current) {
          setIsScriptLoaded(true);
          setIsLoading(false);
        }
      });
    };

    script.onerror = () => {
      if (mountedRef.current) {
        setError(
          "Failed to load the chat assistant. Please try again later."
        );
        setIsLoading(false);
      }
    };

    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    // V4: clear the timeout on cleanup.
    const timeoutId = setTimeout(loadScript, SCRIPT_LOAD_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, [loadScript]);

  // V6: Escape key closes the df-messenger drawer via its DOM API.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // df-messenger exposes a `closeChat()` method on the element.
      const el = document.querySelector("df-messenger") as (HTMLElement & {
        closeChat?: () => void;
      }) | null;
      if (el?.closeChat) {
        el.closeChat();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {/* V5: stylesheet injected once alongside the script */}
      <link rel="stylesheet" href={THEME_HREF} />

      {/* V5: aria-live region announces status changes without visual noise */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {isLoading && "Loading chat assistant…"}
        {error && `Chat assistant error: ${error}`}
        {isScriptLoaded && !error && "Chat assistant ready."}
      </div>

      {isLoading && (
        <div
          className="chatbot-loading"
          role="status"
          aria-label="Loading chat assistant"
        >
          <div className="spinner" aria-hidden="true" />
          <p>Loading assistant…</p>
        </div>
      )}

      {error && (
        <div
          className="chatbot-error"
          role="alert"
          aria-live="assertive"
        >
          <p>{error}</p>
          {/* V5: button has visible text, accessible name is the text */}
          <button
            onClick={() => {
              setError(null);
              setIsLoading(true);
              loadScript();
            }}
            className="retry-button"
            type="button"
          >
            Retry
          </button>
        </div>
      )}

      {isScriptLoaded && !error && (
        /*
         * V5 / accessibility: aria-modal and aria-label are set on the
         * wrapper so assistive tech understands the chat region. The
         * df-messenger component manages its own internal focus when open.
         */
        <div
          role="complementary"
          aria-label="Supply Chain chat assistant"
        >
          <df-messenger
            project-id="supplychain-462215"
            agent-id="7032bfd8-4e8c-45b8-9ef0-b888e4667f6f"
            language-code="en"
            max-query-length="-1"
            allow-feedback="false"
            payload-text-visible="false"
          >
            <df-messenger-chat-bubble chat-title="Supply Chain Assistant" />
          </df-messenger>
        </div>
      )}

      <style>{`
        df-messenger {
          --df-messenger-font-family: 'Poppins', 'Inter', 'Segoe UI', 'Roboto', 'Arial', sans-serif;
          --df-messenger-font-color: #1e293b;
          --df-messenger-chat-background: #f8fafc;
          --df-messenger-message-user-background: #2563eb;
          --df-messenger-message-user-font-color: #fff;
          --df-messenger-message-bot-background: #ffffff;
          --df-messenger-message-bot-font-color: #1e293b;
          --df-messenger-input-box-background: #ffffff;
          --df-messenger-input-box-font-color: #1e293b;
          --df-messenger-send-icon: #2563eb;
          --df-messenger-primary-color: #2563eb;
          --df-messenger-border-radius: 24px;
          --df-messenger-chat-bubble-background: #2563eb;
          --df-messenger-chat-bubble-font-color: #fff;
          --df-messenger-chat-bubble-border-radius: 24px;
          --df-messenger-min-width: 400px;
          --df-messenger-max-width: 440px;
          --df-messenger-box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
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
          background: linear-gradient(135deg, #2563eb 0%, #059669 100%);
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
          background: #2563eb;
          border-radius: 50%;
          transition: transform 0.15s ease, background-color 0.15s ease;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
          width: 48px;
          height: 48px;
        }

        df-messenger::part(send-button):hover {
          background: #1d4ed8;
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
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
        }

        df-messenger::part(message-list) {
          background: #f8fafc;
          padding: 16px;
        }

        df-messenger::part(message-bot) {
          background: #ffffff;
          border-left: 3px solid #2563eb;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
          border-radius: 20px 20px 20px 4px;
          margin: 12px 0;
        }

        df-messenger::part(message-user) {
          background: #2563eb;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
          border-radius: 20px 20px 4px 20px;
          margin: 12px 0;
        }

        df-messenger::part(chat-bubble) {
          background: linear-gradient(135deg, #2563eb 0%, #059669 100%);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
          border-radius: 24px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        df-messenger::part(chat-bubble):hover {
          transform: scale(1.03);
          box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
        }

        /* Hide payload messages */
        df-messenger::part(message-payload),
        df-messenger::part(payload-content) {
          display: none !important;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .spinner { animation: none; }
          df-messenger::part(chat-bubble) { transition: none; }
          df-messenger::part(drawer) { transition: none; }
        }

        @media (max-width: 768px) {
          df-messenger {
            --df-messenger-min-width: 90vw;
            --df-messenger-max-width: 95vw;
            right: 2.5vw;
            bottom: 2.5vw;
          }
        }

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
          .chatbot-loading,
          .chatbot-error {
            right: 10px;
          }
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid #2563eb;
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

        .retry-button {
          background: #2563eb;
          color: #fff;
          border: none;
          border-radius: 20px;
          padding: 8px 16px;
          cursor: pointer;
          transition: background-color 0.15s ease;
          font-weight: 600;
          font-size: 0.875rem;
        }

        .retry-button:hover {
          background: #1d4ed8;
        }

        .retry-button:focus-visible {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }
      `}</style>
    </>
  );
});

SupplyChainChatbot.displayName = "SupplyChainChatbot";

export default SupplyChainChatbot;
