import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

export function initSocketIO(server: http.Server, corsOrigins: string[]) {
  io = new SocketIOServer(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        return callback(null, true);
      },
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    // When a client joins a team room for team-level events (chat, notifications)
    socket.on('join_team', (teamId: number | string) => {
      socket.join(`team_${teamId}`);
    });

    // When a client leaves a team room
    socket.on('leave_team', (teamId: number | string) => {
      socket.leave(`team_${teamId}`);
    });

    // When a user identifies themselves for direct notifications
    socket.on('join_user', (userId: number | string) => {
      socket.join(`user_${userId}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitToTeam(teamId: number | string, event: string, data: any) {
  if (io) {
    io.to(`team_${teamId}`).emit(event, data);
  }
}

export function emitToUser(userId: number | string, event: string, data: any) {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  }
}

