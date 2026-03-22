import { create } from "zustand";
import { wsClient, type WSMessage } from "@/lib/ws";
import { api, type Session } from "@/lib/api";
import { emitCronChange } from "@/lib/events";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  toolCallId?: string;
  toolArgs?: Record<string, unknown>;
  isError?: boolean;
  timestamp: number;
  messageType?: "tool_call" | "permission_request" | "questionnaire" | "thinking";
  status?: "running" | "success" | "error";
  permissionRequestId?: string;
  permissionResolved?: boolean;
  permissionApproved?: boolean;
  questionnaireRequestId?: string;
  questionnaireData?: string; // JSON string of QuestionnaireData
  questionnaireResolved?: boolean;
  questionnaireResponses?: string; // JSON string of QuestionnaireResponses
}

interface ChatState {
  sessions: Session[];
  activeSessionId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  thinkingText: string;

  fetchSessions: (workspaceId: string) => Promise<void>;
  setActiveSession: (sessionId: string, workspaceId: string) => Promise<void>;
  sendMessage: (
    text: string,
    workspaceId: string,
    attachments?: Array<{ mimeType: string; base64: string; name?: string }>,
    fileReferences?: string[],
  ) => void;
  newSession: () => void;
  cancelStream: () => void;
  addThinkingChunk: (text: string) => void;
  flushThinkingText: () => void;
  addStreamChunk: (text: string) => void;
  flushStreamingText: () => void;
  finishStream: () => void;
  addToolCall: (toolName: string, toolCallId: string) => void;
  addToolResult: (
    toolCallId: string,
    content: string,
    opts?: {
      toolName?: string;
      toolArgs?: Record<string, unknown>;
      isError?: boolean;
    },
  ) => void;
  addPermissionMessage: (requestId: string, description: string) => void;
  respondToPermission: (
    messageId: string,
    requestId: string,
    approved: boolean,
  ) => void;
  addQuestionnaireMessage: (
    requestId: string,
    data: Record<string, unknown>,
  ) => void;
  respondToQuestionnaire: (
    messageId: string,
    requestId: string,
    responses: Record<string, unknown>,
  ) => void;
  setError: (error: string) => void;
}

let messageCounter = 0;

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],
  isStreaming: false,
  streamingText: "",
  thinkingText: "",

  fetchSessions: async (workspaceId) => {
    try {
      const sessions = await api.sessions.list(workspaceId);
      set({ sessions });
    } catch {
      set({ sessions: [] });
    }
  },

  setActiveSession: async (sessionId, workspaceId) => {
    try {
      const session = await api.sessions.get(sessionId, workspaceId);
      const messages: ChatMessage[] = [];

      for (const m of session.messages) {
        if (typeof m.content === "string") {
          messages.push({
            id: `msg_${messageCounter++}`,
            role: m.role as ChatMessage["role"],
            content: m.content,
            timestamp: Date.now(),
          });
        } else {
          let textAccum = "";

          for (const part of m.content) {
            if (part.type === "thinking" && part.text) {
              messages.push({
                id: `msg_${messageCounter++}`,
                role: "assistant",
                messageType: "thinking",
                content: part.text,
                timestamp: Date.now(),
              });
            } else if (part.type === "text" && part.text) {
              textAccum += part.text;
            } else if (part.type === "tool_use") {
              // Flush accumulated text before the tool call
              if (textAccum.trim()) {
                messages.push({
                  id: `msg_${messageCounter++}`,
                  role: m.role as ChatMessage["role"],
                  content: textAccum,
                  timestamp: Date.now(),
                });
                textAccum = "";
              }
              messages.push({
                id: `msg_${messageCounter++}`,
                role: "tool",
                messageType: "tool_call",
                toolName: part.toolName,
                toolCallId: part.toolCallId,
                toolArgs: part.toolArguments,
                status: "success",
                content: "",
                timestamp: Date.now(),
              });
            } else if (part.type === "tool_result") {
              // Backfill the result content onto the matching tool_call message
              const resultText = part.text ?? "";
              const matchingCall = messages.find(
                (msg) =>
                  msg.toolCallId === part.toolCallId &&
                  msg.messageType === "tool_call",
              );
              if (matchingCall) {
                matchingCall.content = resultText;
                if (part.isError) matchingCall.status = "error";
              }
              messages.push({
                id: `msg_${messageCounter++}`,
                role: "tool",
                content: resultText,
                toolCallId: part.toolCallId,
                isError: part.isError,
                timestamp: Date.now(),
              });
            }
          }

          // Flush remaining text
          if (textAccum.trim()) {
            messages.push({
              id: `msg_${messageCounter++}`,
              role: m.role as ChatMessage["role"],
              content: textAccum,
              timestamp: Date.now(),
            });
          }
        }
      }

      set({ activeSessionId: sessionId, messages });
    } catch {
      // Session not found
    }
  },

  sendMessage: (text, workspaceId, attachments, fileReferences) => {
    const sessionId =
      get().activeSessionId ??
      `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const userMessage: ChatMessage = {
      id: `msg_${messageCounter++}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    set((s) => ({
      activeSessionId: sessionId,
      messages: [...s.messages, userMessage],
      isStreaming: true,
      streamingText: "",
    }));

    wsClient.sendChat(sessionId, text, workspaceId, attachments, fileReferences);
  },

  newSession: () => {
    set({
      activeSessionId: null,
      messages: [],
      isStreaming: false,
      streamingText: "",
    });
  },

  cancelStream: () => {
    const sessionId = get().activeSessionId;
    if (sessionId) {
      wsClient.sendCancel(sessionId);
    }

    // Mark any running tool calls as errored when cancelled
    set((s) => ({
      isStreaming: false,
      messages: s.messages.map((m) => {
        if (m.messageType === "tool_call" && m.status === "running") {
          return { ...m, status: "error" as const };
        }
        return m;
      }),
    }));
  },

  addThinkingChunk: (text) => {
    set((s) => ({ thinkingText: s.thinkingText + text }));
  },

  flushThinkingText: () => {
    const { thinkingText } = get();
    if (thinkingText.trim()) {
      const thinkingMessage: ChatMessage = {
        id: `msg_${messageCounter++}`,
        role: "assistant",
        messageType: "thinking",
        content: thinkingText,
        timestamp: Date.now(),
      };
      set((s) => ({
        messages: [...s.messages, thinkingMessage],
        thinkingText: "",
      }));
    } else {
      set({ thinkingText: "" });
    }
  },

  addStreamChunk: (text) => {
    set((s) => ({ streamingText: s.streamingText + text }));
  },

  flushStreamingText: () => {
    const { streamingText } = get();
    if (streamingText.trim()) {
      const assistantMessage: ChatMessage = {
        id: `msg_${messageCounter++}`,
        role: "assistant",
        content: streamingText,
        timestamp: Date.now(),
      };
      set((s) => ({
        messages: [...s.messages, assistantMessage],
        streamingText: "",
      }));
    } else {
      set({ streamingText: "" });
    }
  },

  finishStream: () => {
    // Flush any remaining thinking/streaming text
    get().flushThinkingText();
    const { streamingText } = get();
    if (streamingText.trim()) {
      const assistantMessage: ChatMessage = {
        id: `msg_${messageCounter++}`,
        role: "assistant",
        content: streamingText,
        timestamp: Date.now(),
      };
      set((s) => ({
        messages: [...s.messages, assistantMessage],
        isStreaming: false,
        streamingText: "",
        thinkingText: "",
      }));
    } else {
      set({ isStreaming: false, streamingText: "", thinkingText: "" });
    }
  },

  addToolCall: (toolName, toolCallId) => {
    const toolCallMessage: ChatMessage = {
      id: `msg_${messageCounter++}`,
      role: "tool",
      messageType: "tool_call",
      toolName,
      toolCallId,
      status: "running",
      content: "",
      timestamp: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, toolCallMessage] }));
  },

  addToolResult: (toolCallId, content, opts) => {
    set((s) => {
      // Update the matching tool_call message: set status and attach args/result
      const updatedMessages = s.messages.map((m) => {
        if (m.toolCallId === toolCallId && m.messageType === "tool_call") {
          return {
            ...m,
            status: (opts?.isError ? "error" : "success") as
              | "success"
              | "error",
            toolArgs: opts?.toolArgs ?? m.toolArgs,
            toolName: opts?.toolName ?? m.toolName,
            content, // store the result on the tool_call message itself
          };
        }
        return m;
      });

      // Also add a separate tool result message for artifact rendering
      const toolMessage: ChatMessage = {
        id: `msg_${messageCounter++}`,
        role: "tool",
        content,
        toolCallId,
        isError: opts?.isError,
        timestamp: Date.now(),
      };

      return { messages: [...updatedMessages, toolMessage] };
    });
  },

  addPermissionMessage: (requestId, description) => {
    const permMessage: ChatMessage = {
      id: `msg_${messageCounter++}`,
      role: "tool",
      messageType: "permission_request",
      content: description,
      permissionRequestId: requestId,
      permissionResolved: false,
      timestamp: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, permMessage] }));
  },

  respondToPermission: (messageId, requestId, approved) => {
    wsClient.sendPermissionResponse(requestId, approved);
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId
          ? { ...m, permissionResolved: true, permissionApproved: approved }
          : m,
      ),
    }));
  },

  addQuestionnaireMessage: (requestId, data) => {
    const questionnaireMessage: ChatMessage = {
      id: `msg_${messageCounter++}`,
      role: "tool",
      messageType: "questionnaire",
      content: (data.title as string) || "Questionnaire",
      questionnaireRequestId: requestId,
      questionnaireData: JSON.stringify(data),
      questionnaireResolved: false,
      timestamp: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, questionnaireMessage] }));
  },

  respondToQuestionnaire: (messageId, requestId, responses) => {
    wsClient.sendQuestionnaireResponse(requestId, responses);
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              questionnaireResolved: true,
              questionnaireResponses: JSON.stringify(responses),
            }
          : m,
      ),
    }));
  },

  setError: (error) => {
    set((s) => {
      // Mark any running tool calls as errored
      const updatedMessages = s.messages.map((m) => {
        if (m.messageType === "tool_call" && m.status === "running") {
          return { ...m, status: "error" as const };
        }
        return m;
      });

      const errorMessage: ChatMessage = {
        id: `msg_${messageCounter++}`,
        role: "assistant",
        content: `Error: ${error}`,
        isError: true,
        timestamp: Date.now(),
      };

      return {
        messages: [...updatedMessages, errorMessage],
        isStreaming: false,
        streamingText: "",
      };
    });
  },
}));

// Wire up WebSocket events to store
wsClient.on("*", (msg: WSMessage) => {
  const store = useChatStore.getState();
  switch (msg.type) {
    case "thinking_delta":
      store.addThinkingChunk(msg.text);
      break;
    case "text_delta":
      store.flushThinkingText();
      store.addStreamChunk(msg.text);
      break;
    case "tool_call_start":
      store.flushThinkingText();
      store.flushStreamingText();
      store.addToolCall(msg.toolName, msg.toolCallId);
      break;
    case "tool_result":
      store.addToolResult(msg.toolCallId, msg.content, {
        toolName: msg.toolName,
        toolArgs: msg.toolArgs,
        isError: msg.isError,
      });
      break;
    case "permission_request":
      store.flushStreamingText();
      store.addPermissionMessage(msg.requestId, msg.description);
      break;
    case "questionnaire_request":
      store.flushStreamingText();
      store.addQuestionnaireMessage(msg.requestId, msg.data);
      break;
    case "done": {
      store.finishStream();
      // Refresh session list to pick up auto-generated title
      const ws = useWorkspaceStore.getState().activeWorkspace;
      if (ws) store.fetchSessions(ws.id);
      // Refresh sidebar cron list (agent may have created/modified cron jobs)
      emitCronChange();
      break;
    }
    case "session:refresh": {
      const activeWs = useWorkspaceStore.getState().activeWorkspace;
      if (activeWs && activeWs.id === msg.workspaceId) {
        store.fetchSessions(activeWs.id);
      }
      break;
    }
    case "error":
      store.setError(msg.error);
      break;
  }
});
