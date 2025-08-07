// src/domain/interfaces/account.repository.interface.ts
// CONSOLIDADO - Esta es la única versión que debe existir

import { Account } from '../entities/account.entity';

export interface IAccountRepository {
  save(account: Account): Promise<void>;
  saveMany(accounts: Account[]): Promise<void>;
  findById(id: string): Promise<Account | null>;
  findByExternalId(externalId: string): Promise<Account | null>;
  findByExternalIds(externalIds: string[]): Promise<Account[]>;
  findAll(): Promise<Account[]>;
  findByStatus(status: string): Promise<Account[]>;
  update(id: string, updateData: Partial<Account>): Promise<void>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
  exists(id: string): Promise<boolean>;
}
