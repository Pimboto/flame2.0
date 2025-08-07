// src/domain/interfaces/queue-manager.interface.ts

export interface QueueJob {
  id: string;
  name: string;
  data: any;
  priority?: number;
  delay?: number;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface IQueueManager {
  createQueue(name: string, config?: any): Promise<any>;
  getQueue(name: string): any;
  getQueueStats(name?: string): Promise<QueueStats | any>;
  pauseQueue(name: string): Promise<void>;
  resumeQueue(name: string): Promise<void>;
  cleanQueue(name: string, grace?: number): Promise<void>;
  cleanAllQueues(grace?: number): Promise<void>;
  closeQueue(name: string): Promise<void>;
  closeAll(): Promise<void>;
  getActiveQueues(): string[];
  getQueueSize(name: string): Promise<number>;
}
