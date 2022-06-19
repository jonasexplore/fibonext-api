import { CACHE_MANAGER, Inject, Injectable, Logger } from '@nestjs/common';
import { WebSocketServer } from '@nestjs/websockets';
import { Cache } from 'cache-manager';
import { Server } from 'socket.io';
import { RegisterVoteType, NOT_FOUND } from '../types';
import { GetRoomByClientId } from './get-room-by-client-id';
import { GetVotesByRoom } from './get-votes-by-room';

@Injectable()
export class RegisterVote {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly getRoomByClientId: GetRoomByClientId,
    private readonly getVotesByRoom: GetVotesByRoom,
  ) {}

  private readonly logger = new Logger(RegisterVote.name);

  @WebSocketServer()
  public server: Server;

  async handle({ clientId, value }: RegisterVoteType): Promise<void> {
    try {
      const roomId = await this.getRoomByClientId.handle(clientId);
      const votes = await this.getVotesByRoom.handle(roomId);

      const voteIndex = votes.findIndex((vote) => vote.clientId === clientId);

      if (voteIndex === NOT_FOUND) {
        votes.push({
          value,
          clientId: clientId,
        });
      } else {
        votes[voteIndex].value = value;
      }

      this.server.to(roomId).emit('room:votes', votes);
      await this.cacheManager.set(roomId, votes);
    } catch (error) {
      this.logger.error(error);
    }
  }
}
