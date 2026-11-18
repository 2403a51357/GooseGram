/**
 * Supabase Realtime WebSocket Client for CampusVoice / GooseGram
 * Implements Phoenix Channels protocol over native browser WebSocket (HTTP 101).
 * Zero extra npm dependencies, zero bundle bloat.
 */

const SUPABASE_WS_URL = "wss://qulowdwqfnodoufzopcf.supabase.co/realtime/v1/websocket?apikey=sb_publishable_bREODvQh1hUmXc9Hnaunsw_n8qtUKLB&vsn=1.0.0";

class RealtimeClient {
  constructor() {
    this.ws = null;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.subscribers = new Set();
    this.refCounter = 1;
    this.isConnected = false;
    this.init();
  }

  init() {
    if (typeof window === "undefined" || typeof WebSocket === "undefined") return;

    try {
      this.ws = new WebSocket(SUPABASE_WS_URL);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.startHeartbeat();
        this.joinMessagesChannel();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Supabase Realtime Postgres Changes
          if (
            (data.event === "postgres_changes" || data.event === "INSERT") &&
            data.payload
          ) {
            const record = data.payload.data?.record || data.payload.record || data.payload.new;
            if (record) {
              this.subscribers.forEach((cb) => {
                try {
                  cb(record);
                } catch (err) {
                  console.error("Realtime subscriber error:", err);
                }
              });
            }
          }
        } catch {
          // Ignore parse errors on heartbeats/acks
        }
      };

      this.ws.onerror = (e) => {
        console.warn("Supabase Realtime WS error:", e);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.stopHeartbeat();
        // Exponential / 3s reconnect
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.init(), 3000);
      };
    } catch (e) {
      console.warn("Could not establish Supabase Realtime WS:", e);
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          topic: "phoenix",
          event: "heartbeat",
          payload: {},
          ref: String(this.refCounter++)
        });
      }
    }, 25000);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  joinMessagesChannel() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.send({
      topic: "realtime:public:messages",
      event: "phx_join",
      payload: {
        config: {
          postgres_changes: [
            { event: "INSERT", schema: "public", table: "messages" }
          ]
        }
      },
      ref: String(this.refCounter++)
    });
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  /**
   * Subscribe to new incoming messages across the app.
   * @param {Function} callback (newRecord) => void
   * @returns {Function} unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }
}

export const realtimeClient = new RealtimeClient();
