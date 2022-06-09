import { CACHE_MANAGER, Inject, Injectable, Logger } from '@nestjs/common';
import {
  MessageBody,
  WebSocketServer,
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Cache } from 'cache-manager';
import { Server, Socket } from 'socket.io';

type VoteRedisProps = {
  value: number;
  clientId: string;
};

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@Injectable()
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  private readonly logger = new Logger('EventsGateway');

  @WebSocketServer()
  private server: Server;

  getSocketsByRoom(roomId: string): Array<string> {
    try {
      const allSockets = this.server.sockets.adapter.rooms.get(roomId) || [];
      return Array.from(allSockets).map(([socketId]) => socketId);
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getVotesByRoom(roomId: string): Promise<Array<VoteRedisProps>> {
    try {
      const votes = await this.cacheManager.get<Array<VoteRedisProps>>(roomId);
      return votes || [];
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getRoomByClientId(clientId: string): Promise<string | null> {
    try {
      const roomId = await this.cacheManager.get<string>(clientId);
      return roomId || '';
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    this.logger.log(`Client disconnected: ${client.id}`);
    const roomId = await this.getRoomByClientId(client.id);

    if (roomId) {
      const votes = await this.getVotesByRoom(roomId);
      const removedClientVote = votes.filter(
        ({ clientId }) => clientId !== client.id,
      );
      await this.cacheManager.set(roomId, removedClientVote);

      this.server.to(roomId).emit('votes', removedClientVote);
      await this.cacheManager.del(client.id);

      const socketsByRoom = this.getSocketsByRoom(roomId);
      this.server.to(roomId).emit('users', socketsByRoom);
    }
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  async registerVote(
    value: number,
    roomId: string,
    clientId: string,
  ): Promise<void> {
    const votes = await this.getVotesByRoom(roomId);

    const voteIndex = votes.findIndex((vote) => vote.clientId === clientId);

    if (voteIndex !== -1) {
      votes[voteIndex].value = value;
    } else {
      votes.push({
        value,
        clientId: clientId,
      });
    }

    this.server.to(roomId).emit('votes', votes);
    await this.cacheManager.set(roomId, votes);
  }

  @SubscribeMessage('votes')
  async votes(
    @MessageBody() value: number,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const roomId = await this.getRoomByClientId(client.id);
    await this.registerVote(value, roomId, client.id);
  }

  @SubscribeMessage('join:room')
  async room(
    @MessageBody() roomId: string,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    if (roomId) {
      client.join(roomId);
      await this.cacheManager.set(client.id, roomId);

      this.logger.log(`Client ${client.id} joined room: ${roomId}`);

      const socketsByRoom = this.getSocketsByRoom(roomId);
      const votesByRoom = await this.getVotesByRoom(roomId);
      this.server.to(roomId).emit('users', socketsByRoom);
      this.server.to(roomId).emit('votes', votesByRoom);
    }
  }
}
