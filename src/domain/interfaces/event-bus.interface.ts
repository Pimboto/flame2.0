// src/domain/interfaces/event-bus.interface.ts

export interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  occurredAt: Date;
  payload: any;
}

export interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
  publishMany(events: DomainEvent[]): Promise<void>;
  subscribe(
    eventType: string,
    handler: (event: DomainEvent) => Promise<void>,
  ): void;
  unsubscribe(
    eventType: string,
    handler: (event: DomainEvent) => Promise<void>,
  ): void;
}
