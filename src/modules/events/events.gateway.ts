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
import {
  GetRoomByClientId,
  GetSocketsByRoom,
  GetVotesByRoom,
  RegisterVote,
  ResetVotes,
} from './use-cases';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@Injectable()
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly getRoomByClientId: GetRoomByClientId,
    private readonly getSocketsByRoom: GetSocketsByRoom,
    private readonly getVotesByRoom: GetVotesByRoom,
    private readonly registerVote: RegisterVote,
    private readonly resetVotes: ResetVotes,
  ) {}

  private readonly logger = new Logger('EventsGateway');

  @WebSocketServer()
  private server: Server;

  afterInit(server: Server) {
    this.registerVote.server = server;
    this.getSocketsByRoom.server = server;
  }

  async handleDisconnect(client: Socket): Promise<void> {
    this.logger.log(`Client disconnected: ${client.id}`);
    const roomId = await this.getRoomByClientId.handle(client.id);

    if (!roomId) {
      return;
    }

    const votes = await this.getVotesByRoom.handle(roomId);

    const removedClientVote = votes.filter(
      ({ clientId }) => clientId !== client.id,
    );
    await this.cacheManager.set(roomId, removedClientVote);

    this.server.to(roomId).emit('room:votes', removedClientVote);
    await this.cacheManager.del(client.id);

    const socketsByRoom = this.getSocketsByRoom.handle(roomId);
    this.server.to(roomId).emit('room:users', socketsByRoom);
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  @SubscribeMessage('room:votes')
  async votes(
    @MessageBody() value: number,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    await this.registerVote.handle({ value, clientId: client.id });
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

      const socketsByRoom = this.getSocketsByRoom.handle(roomId);
      const votesByRoom = await this.getVotesByRoom.handle(roomId);
      const visibility = await this.cacheManager.get(`${roomId}:visibility`);

      this.server.to(roomId).emit('room:users', socketsByRoom);
      this.server.to(roomId).emit('room:votes', votesByRoom);
      this.server.to(roomId).emit('room:visibility', visibility);
    }
  }

  @SubscribeMessage('room:visibility')
  async visibility(@ConnectedSocket() client: Socket): Promise<void> {
    try {
      const roomId = await this.getRoomByClientId.handle(client.id);
      const visibility =
        (await this.cacheManager
          .get(`${roomId}:visibility`)
          .catch(() => false)) || false;

      await this.cacheManager.set(`${roomId}:visibility`, !visibility);

      this.server.to(roomId).emit('room:visibility', !visibility);
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }

  @SubscribeMessage('room:reset')
  async reset(@ConnectedSocket() client: Socket): Promise<void> {
    try {
      const roomId = await this.getRoomByClientId.handle(client.id);
      await this.resetVotes.handle(roomId);

      this.server.to(roomId).emit('room:votes', []);
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }
}
