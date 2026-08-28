export type DomainEvent<T = unknown> = {
  name: string;
  tenantId: string;
  occurredAt: string;
  payload: T;
};

export type EventHandler<T = unknown> = (e: DomainEvent<T>) => Promise<void> | void;

export interface EventBus {
  publish<T>(event: DomainEvent<T>): Promise<void>;
  subscribe<T>(name: string, handler: EventHandler<T>): () => void;
}

export class InMemoryEventBus implements EventBus {
  private handlers = new Map<string, Set<EventHandler<unknown>>>();

  async publish<T>(event: DomainEvent<T>): Promise<void> {
    const set = this.handlers.get(event.name);
    if (!set) return;
    await Promise.all([...set].map((h) => h(event as DomainEvent<unknown>)));
  }

  subscribe<T>(name: string, handler: EventHandler<T>): () => void {
    let set = this.handlers.get(name);
    if (!set) {
      set = new Set();
      this.handlers.set(name, set);
    }
    set.add(handler as EventHandler<unknown>);
    return () => set!.delete(handler as EventHandler<unknown>);
  }
}
