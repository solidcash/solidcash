import { EventEmitter } from 'eventemitter3';
import type {
  ElectrumSocket, ElectrumSocketEvents, ElectrumSocketOptions,
} from '@electrum-cash/socket';

/** Options for {@link TokenWebSocket}: the socket defaults plus the devnet token. */
export interface TokenWebSocketOptions extends ElectrumSocketOptions {
  /** Appended to the upgrade URL as `?token=`; required when the devnet is not on loopback. */
  readonly token?: string;
}

/** The subset of the WebSocket API both Node's `ws` and the browser implement. */
interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeEventListener?(event: string, listener: (...args: unknown[]) => void): void;
  addEventListener?(event: string, listener: (...args: unknown[]) => void): void;
}

type WebSocketConstructor = new (url: string) => WebSocketLike;

const CONNECTING = 0;
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

/**
 * `ElectrumSocket` implementation that appends `?token=` to the upgrade URL.
 *
 * The token travels in the query (not a header) because the native browser WebSocket cannot set headers; the server
 * accepts both. No page-visibility listeners are installed, so a background tab keeps its subscription.
 */
export class TokenWebSocket extends EventEmitter<ElectrumSocketEvents> implements ElectrumSocket {
  readonly host: string;
  readonly options: TokenWebSocketOptions;

  // EventEmitter's typed surface provides emit/on; these satisfy ElectrumSocket's event-name properties.
  declare readonly data: never;
  declare readonly connected: never;
  declare readonly disconnected: never;

  private socket?: WebSocketLike;
  private connecting?: Promise<void>;
  private disconnecting?: Promise<void>;
  /** Ensures exactly one `disconnected` per socket, as `ElectrumClient` requires. */
  private closeEmitted = false;

  constructor(host: string, options: TokenWebSocketOptions) {
    super();
    this.host = host;
    this.options = options;
  }

  /** The upgrade URL this socket opens. */
  get url(): string {
    const protocol = this.options.encrypted ? 'wss' : 'ws';
    const token = this.options.token;
    const query = token === undefined || token === '' ? '' : `?token=${encodeURIComponent(token)}`;
    return `${protocol}://${this.host}:${this.options.port}/${query}`;
  }

  get status(): number {
    return this.socket?.readyState ?? CLOSED;
  }

  get isConnecting(): boolean {
    return this.status === CONNECTING;
  }

  get isConnected(): boolean {
    return this.status === OPEN;
  }

  get isDisconnecting(): boolean {
    return this.status === CLOSING;
  }

  get isDisconnected(): boolean {
    return this.status === CLOSED;
  }

  /** Resolve the WebSocket constructor in Node and the browser without a static server-only import. */
  private constructorFor(): WebSocketConstructor {
    const globalWithWebSocket = globalThis as { WebSocket?: WebSocketConstructor };
    if (typeof globalWithWebSocket.WebSocket === 'function') return globalWithWebSocket.WebSocket;
    throw new Error('TokenWebSocket: no WebSocket implementation is available in this runtime');
  }

  connect(): Promise<void> {
    if (this.isConnected) return Promise.resolve();
    if (this.connecting !== undefined) return this.connecting;
    const promise = new Promise<void>((resolve, reject) => {
      const Socket = this.constructorFor();
      const socket = new Socket(this.url);
      this.socket = socket;
      this.closeEmitted = false;

      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          socket.close();
        } catch { /* already closed */ }
        reject(new Error(`TokenWebSocket: connection to ${this.url} timed out after ${this.options.timeoutInMilliSeconds}ms`));
      }, this.options.timeoutInMilliSeconds);
      if (typeof (timer as unknown as { unref?: () => void }).unref === 'function') (timer as unknown as { unref: () => void }).unref();

      const on = (event: string, listener: (...args: unknown[]) => void): void => {
        if (typeof socket.on === 'function') socket.on(event, listener);
        else socket.addEventListener?.(event, listener);
      };

      on('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.emit('connected');
        resolve();
      });
      on('error', (error: unknown) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(`TokenWebSocket: connection to ${this.url} failed`));
        }
        // A failed connect must report a disconnection exactly once: the client waits for this event before it
        // settles its own connect promise or schedules a reconnect.
        if (this.closeEmitted) return;
        this.closeEmitted = true;
        this.emit('disconnected');
      });
      on('message', (payload: unknown) => {
        // `ws` passes the payload; the browser/undici API passes a MessageEvent.
        const data = (payload as { data?: unknown }).data ?? payload;
        const text = typeof data === 'string'
          ? data
          : data instanceof Uint8Array ? new TextDecoder().decode(data) : String(data);
        // `ElectrumClient` splits its buffer on newlines, so every message carries exactly one delimiter.
        this.emit('data', `${text.replace(/\n+$/, '')}\n`);
      });
      on('close', () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error(`TokenWebSocket: ${this.url} closed before the handshake completed`));
        }
        if (this.closeEmitted) return;
        this.closeEmitted = true;
        this.emit('disconnected');
      });
    });
    this.connecting = promise.finally(() => {
      this.connecting = undefined;
    });
    return this.connecting;
  }

  disconnect(): Promise<void> {
    if (this.disconnecting !== undefined) return this.disconnecting;
    const socket = this.socket;
    if (socket === undefined || socket.readyState === CLOSED) {
      this.socket = undefined;
      return Promise.resolve();
    }
    const promise = new Promise<void>((resolve) => {
      const timer = setTimeout(() => resolve(), 1_000);
      if (typeof (timer as unknown as { unref?: () => void }).unref === 'function') (timer as unknown as { unref: () => void }).unref();
      const done = (): void => {
        clearTimeout(timer);
        resolve();
      };
      if (typeof socket.on === 'function') socket.on('close', done);
      else socket.addEventListener?.('close', done);
      try {
        socket.close();
      } catch {
        done();
      }
    });
    this.disconnecting = promise.finally(() => {
      this.disconnecting = undefined;
      this.socket = undefined;
      if (!this.closeEmitted) {
        this.closeEmitted = true;
        this.emit('disconnected');
      }
    });
    return this.disconnecting;
  }

  write(data: string): Promise<boolean> {
    const socket = this.socket;
    if (socket === undefined || socket.readyState !== OPEN) {
      return Promise.reject(new Error('TokenWebSocket: cannot write to a socket that is not open'));
    }
    socket.send(data);
    return Promise.resolve(true);
  }
}
