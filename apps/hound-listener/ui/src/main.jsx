import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

function appendBootError(label, value) {
  const el = document.createElement("pre");
  el.style.padding = "12px";
  el.style.margin = "8px 12px";
  el.style.background = "#220";
  el.style.color = "#ff9";
  el.style.whiteSpace = "pre-wrap";
  el.textContent = `${label}\n${String(value || "")}`;
  document.body.appendChild(el);
}

window.addEventListener("error", (event) => {
  appendBootError("Boot JS Error", event?.error?.stack || event?.message || "unknown");
});

window.addEventListener("unhandledrejection", (event) => {
  appendBootError("Boot Promise Rejection", event?.reason?.stack || event?.reason || "unknown");
});

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, fontFamily: "monospace", color: "#b00020" }}>
          <h2>Listener Runtime Error</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{String(this.state.error?.stack || this.state.error?.message || this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);

const bootMarker = document.getElementById("boot-marker");
if (bootMarker) bootMarker.remove();
