import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F8FAFC",
          color: "#0F172A",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "24px",
          textAlign: "center"
        }}>
          <div style={{
            maxWidth: "540px",
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "16px",
            padding: "32px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)"
          }}>
            <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚠️</div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 8px", color: "#0F172A" }}>
              Something went wrong loading GooseGram
            </h2>
            <p style={{ fontSize: "14px", color: "#64748B", margin: "0 0 20px", lineHeight: "1.5" }}>
              An unexpected display issue occurred. We've logged this to console.
            </p>
            {this.state.error && (
              <pre style={{
                background: "#F1F5F9",
                padding: "12px 16px",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#DC2626",
                textAlign: "left",
                overflowX: "auto",
                marginBottom: "20px",
                fontFamily: "monospace"
              }}>
                {String(this.state.error?.message || this.state.error)}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              style={{
                background: "#0F172A",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "9999px",
                padding: "10px 24px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.2s"
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
