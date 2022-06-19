import { CACHE_MANAGER, Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class GetRoomByClientId {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}
  private readonly logger = new Logger(GetRoomByClientId.name);

  async handle(clientId: string): Promise<string | null> {
    try {
      const roomId = await this.cacheManager.get<string>(clientId);
      return roomId || '';
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }
}
