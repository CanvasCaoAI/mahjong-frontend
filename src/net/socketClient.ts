import { io, Socket } from 'socket.io-client';
import type { PublicState } from '../domain/types';

export type ClientEvents = {
  state: (st: PublicState) => void;
  errorMsg: (e: { message: string }) => void;
};

export class MahjongClient {
  private socket: Socket | null = null;

  connect(serverUrl: string, params: { roomId: string; clientId: string }, onState: (st: PublicState) => void, onError: (msg: string) => void) {
    this.socket?.disconnect();
    this.socket = io(serverUrl, { transports: ['websocket'], auth: params });

    this.socket.on('state', onState);
    this.socket.on('errorMsg', (e: { message: string }) => onError(e.message));

    this.socket.on('connect_error', () => onError('连接服务器失败，请确认后端已启动。'));
  }

  get connected() {
    return !!this.socket?.connected;
  }

  setName(name: string) {
    this.socket?.emit('setName', { name });
  }

  ready() {
    this.socket?.emit('ready');
  }

  draw() {
    this.socket?.emit('draw');
  }

  discard(index: number) {
    this.socket?.emit('discard', { index });
  }

  checkWin() {
    this.socket?.emit('checkWin');
  }

  peng() {
    this.socket?.emit('peng');
  }

  passClaim() {
    this.socket?.emit('passClaim');
  }

  chi() {
    this.socket?.emit('chi');
  }
}
