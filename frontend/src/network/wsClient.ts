import { httpJson } from "./httpClient";
import type { WsClientMessage, WsServerMessage, WsTicketResponse } from "./types";

export type WsHandler = (msg: WsServerMessage) => void;

let reqCounter = 0;

export function nextRequestId(): string {
  reqCounter += 1;
  return `req_${Date.now()}_${reqCounter}`;
}

/**
 * Garden WebSocket: ticket from REST, then `wsUrl?ticket=`.
 * On disconnect, caller must fetch a new ticket before reconnecting (doc §7.1).
 */
export class GardenWsClient {
  private socket: WebSocket | null = null;
  private handlers: WsHandler[] = [];

  private readonly onConnectionChange: (state: "connecting" | "open" | "closed") => void;

  constructor(onConnectionChange: (state: "connecting" | "open" | "closed") => void) {
    this.onConnectionChange = onConnectionChange;
  }

  subscribe(fn: WsHandler): () => void {
    this.handlers.push(fn);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== fn);
    };
  }

  private emit(msg: WsServerMessage): void {
    for (const h of this.handlers) h(msg);
  }

  async connect(): Promise<WsTicketResponse> {
    this.close();
    this.onConnectionChange("connecting");
    const ticketPayload = await httpJson<WsTicketResponse>("/gardens/ws-ticket");
    const url = `${ticketPayload.wsUrl}?ticket=${encodeURIComponent(ticketPayload.ticket)}`;
    return new Promise<WsTicketResponse>((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(url);
      this.socket = ws;
      ws.onopen = () => {
        if (settled) return;
        settled = true;
        this.onConnectionChange("open");
        resolve(ticketPayload);
      };
      ws.onerror = () => {
        if (settled) return;
        settled = true;
        this.onConnectionChange("closed");
        reject(new Error("WebSocket connection failed"));
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as WsServerMessage;
          this.emit(msg);
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        this.socket = null;
        this.onConnectionChange("closed");
      };
    });
  }

  send(msg: WsClientMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(msg));
  }

  joinGarden(gardenId: string, requestId: string): void {
    this.send({
      type: "joinGarden",
      requestId,
      payload: { gardenId, clientViewport: { width: window.innerWidth, height: window.innerHeight } },
    });
  }

  updatePointer(gardenId: string, x: number, y: number, requestId: string): void {
    this.send({
      type: "updatePointer",
      requestId,
      payload: { gardenId, x, y },
    });
  }

  petAction(
    gardenId: string,
    petId: string,
    actionType: string,
    requestId: string,
    itemId?: string,
  ): void {
    this.send({
      type: "petAction",
      requestId,
      payload: { gardenId, petId, actionType, ...(itemId ? { itemId } : {}) },
    });
  }

  close(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
