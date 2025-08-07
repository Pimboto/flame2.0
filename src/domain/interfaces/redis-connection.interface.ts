// src/domain/interfaces/redis-connection.interface.ts

export interface IRedisConnection {
  isRedisAvailable: boolean;
  getConnection(name?: string): Promise<any>;
  closeConnection(name: string): Promise<void>;
  closeAll(): Promise<void>;
  getConnectionInfo(): Promise<any>;
}
