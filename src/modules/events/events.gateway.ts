import {
  MessageBody,
  WebSocketServer,
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  stateVotes: Array<number> = [];

  handleDisconnect(client: Socket) {
    console.log('Disconnected: ', client?.id);
    const usersConnected = Array.from(this.server.sockets.sockets).map(
      ([socketId]) => socketId,
    );

    this.server.sockets.emit('users', usersConnected);
  }

  handleConnection(client: Socket) {
    console.log('Connected: ', client?.id);
    const usersConnected = Array.from(this.server.sockets.sockets).map(
      ([socketId]) => socketId,
    );

    client.emit('votes', this.stateVotes);

    this.server.sockets.emit('users', usersConnected);
  }

  @SubscribeMessage('votes')
  votes(@MessageBody() data: number): void {
    this.stateVotes.push(data);
    this.server.sockets.emit('votes', this.stateVotes);
  }

  @SubscribeMessage('join:room')
  room(@MessageBody() roomId: string, @ConnectedSocket() client: Socket): void {
    console.log('Joining room: ', roomId);

    client.join(roomId);
    this.server.to(roomId).emit(roomId);
  }
}
