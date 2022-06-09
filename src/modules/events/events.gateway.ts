import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
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

  @WebSocketServer()
  private server: Server;

  getSocketsByRoom(roomId: string): Array<string> {
    const allSockets = this.server.sockets.adapter.rooms.get(roomId);

    return Array.from(allSockets).map(([socketId]) => socketId);
  }

  async getVotesByRoom(roomId: string): Promise<Array<VoteRedisProps>> {
    const votes = await this.cacheManager.get<Array<VoteRedisProps>>(roomId);
    return votes || [];
  }

  async getRoomByClientId(clientId: string): Promise<string> {
    const roomId = await this.cacheManager.get<string>(clientId);
    return roomId || '';
  }

  async handleDisconnect(client: Socket): Promise<void> {
    console.log('Disconnected: ', client?.id);
    const roomId = await this.getRoomByClientId(client.id);

    const votes = await this.getVotesByRoom(roomId);
    const removedClientVote = votes.filter(
      ({ clientId }) => clientId !== client.id,
    );
    await this.cacheManager.set(roomId, removedClientVote);

    const socketsByRoom = this.getSocketsByRoom(roomId);
    this.server.to(roomId).emit('users', socketsByRoom);
    this.server.to(roomId).emit('votes', removedClientVote);
    await this.cacheManager.del(client.id);
  }

  handleConnection(client: Socket) {
    console.log('Connected: ', client?.id);
  }

  async registerVote(
    value: number,
    roomId: string,
    clientId: string,
  ): Promise<void> {
    const votes = await this.getVotesByRoom(roomId);
    console.log({ votes });

    const voteIndex = votes.findIndex((vote) => vote.clientId === clientId);

    if (voteIndex !== -1) {
      votes[voteIndex].value = value;
    } else {
      votes.push({
        value,
        clientId: clientId,
      });
    }

    await this.cacheManager.set(roomId, votes);
    this.server.to(roomId).emit('votes', votes);
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
    client.join(roomId);
    await this.cacheManager.set(client.id, roomId);

    console.log('Joining room: ', roomId);

    const socketsByRoom = this.getSocketsByRoom(roomId);
    const votesByRoom = await this.getVotesByRoom(roomId);
    this.server.to(roomId).emit('users', socketsByRoom);
    this.server.to(roomId).emit('votes', votesByRoom);
  }
}
