import { CACHE_MANAGER, Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class ResetVotes {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}
  private readonly logger = new Logger(ResetVotes.name);

  async handle(roomId: string): Promise<void> {
    try {
      await this.cacheManager.set(roomId, []);
    } catch (error) {
      this.logger.error(error);
    }
  }
}
