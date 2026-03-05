import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";

function wireGlobalErrorLogging() {
  const send = (message: string, stack?: string) => {
    try {
      fetch("/api/diag/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, stack, level: "error" })
      }).catch(() => {});
    } catch {
      // ignore
    }
  };
  window.addEventListener("error", (event) => {
    send(event.message, event.error?.stack);
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    send(
      typeof reason === "string" ? reason : reason?.message ?? "unhandled rejection",
      reason?.stack
    );
  });
}

wireGlobalErrorLogging();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
