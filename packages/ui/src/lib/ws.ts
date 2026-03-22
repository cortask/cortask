export type WSMessage =
  | { type: "thinking_delta"; sessionKey: string; text: string }
  | { type: "text_delta"; sessionKey: string; text: string }
  | {
      type: "tool_call_start";
      sessionKey: string;
      toolName: string;
      toolCallId: string;
    }
  | {
      type: "tool_result";
      sessionKey: string;
      toolCallId: string;
      toolName?: string;
      toolArgs?: Record<string, unknown>;
      content: string;
      isError?: boolean;
    }
  | {
      type: "permission_request";
      requestId: string;
      description: string;
    }
  | {
      type: "questionnaire_request";
      requestId: string;
      data: Record<string, unknown>;
    }
  | {
      type: "done";
      sessionKey: string;
      usage: { inputTokens: number; outputTokens: number };
    }
  | { type: "error"; sessionKey: string; error: string }
  | { type: "channel:status"; channelId: string; running: boolean; authenticated?: boolean }
  | { type: "session:refresh"; workspaceId: string };

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<(msg: WSMessage) => void>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _connected = false;
  private connectionListeners = new Set<() => void>();

  get connected() {
    return this._connected;
  }

  onConnectionChange(cb: () => void) {
    this.connectionListeners.add(cb);
    return () => this.connectionListeners.delete(cb);
  }

  private setConnected(value: boolean) {
    if (this._connected !== value) {
      this._connected = value;
      for (const cb of this.connectionListeners) cb();
    }
  }

  connect(url?: string) {
    const wsUrl =
      url ??
      `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.setConnected(true);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        this.emit(msg.type, msg);
        this.emit("*", msg);
      } catch {
        // Invalid message
      }
    };

    this.ws.onclose = () => {
      this.setConnected(false);
      this.reconnectTimer = setTimeout(() => this.connect(url), 3000);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  send(data: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  sendChat(
    sessionKey: string,
    message: string,
    workspaceId: string,
    attachments?: Array<{ mimeType: string; base64: string; name?: string }>,
    fileReferences?: string[],
  ) {
    this.send({
      type: "chat",
      sessionKey,
      message,
      workspaceId,
      ...(attachments?.length ? { attachments } : {}),
      ...(fileReferences?.length ? { fileReferences } : {}),
    });
  }

  sendCancel(sessionKey: string) {
    this.send({ type: "cancel", sessionKey });
  }

  sendPermissionResponse(requestId: string, approved: boolean) {
    this.send({ type: "permission_response", requestId, approved });
  }

  sendQuestionnaireResponse(
    requestId: string,
    responses: Record<string, unknown>,
  ) {
    this.send({ type: "questionnaire_response", requestId, responses });
  }

  on(event: string, callback: (msg: WSMessage) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, msg: WSMessage) {
    this.listeners.get(event)?.forEach((cb) => cb(msg));
  }
}

export const wsClient = new WebSocketClient();
