import { CacheModule, Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import * as redisStore from 'cache-manager-redis-store';
import { ConfigModule } from '@nestjs/config';
import {
  GetRoomByClientId,
  GetSocketsByRoom,
  GetVotesByRoom,
  RegisterVote,
  ResetVotes,
} from './use-cases';

@Module({
  imports: [
    ConfigModule.forRoot(),
    CacheModule.register({
      store: redisStore,
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      user: process.env.REDIS_USER,
      password: process.env.REDIS_PASSWORD,
      ttl: 3600,
    }),
  ],
  providers: [
    EventsGateway,
    GetRoomByClientId,
    GetSocketsByRoom,
    GetVotesByRoom,
    RegisterVote,
    ResetVotes,
  ],
})
export class EventsModule {}
