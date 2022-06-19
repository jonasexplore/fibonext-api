import { CACHE_MANAGER, Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { VoteType } from '../types/vote';

@Injectable()
export class GetVotesByRoom {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}
  private readonly logger = new Logger(GetVotesByRoom.name);

  async handle(roomId: string): Promise<Array<VoteType>> {
    try {
      const votes = await this.cacheManager.get<Array<VoteType>>(roomId);
      return votes || [];
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }
}
