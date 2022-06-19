import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { WebSocketServer } from '@nestjs/websockets';

@Injectable()
export class GetSocketsByRoom {
  private readonly logger = new Logger(GetSocketsByRoom.name);

  @WebSocketServer()
  public server: Server;

  handle(roomId: string): Array<string> {
    try {
      const allSockets = this.server.sockets.adapter.rooms.get(roomId) || [];
      return Array.from(allSockets).map(([socketId]) => socketId);
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }
}
