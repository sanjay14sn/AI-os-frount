import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { env } from './env';

let io: SocketIOServer;

export const initSocket = (server: HttpServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: (origin: string | undefined, callback: (err: Error | null, success?: boolean) => void) => {
        callback(null, true);
      },
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.on('join_chat', (userId: string) => {
      socket.join(userId);
    });
  });

  return io;
};

export const getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};
