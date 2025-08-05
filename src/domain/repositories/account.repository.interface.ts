import { Account } from '../entities/account.entity';

export interface IAccountRepository {
  save(account: Account): Promise<void>;
  saveMany(accounts: Account[]): Promise<void>;
  findById(id: string): Promise<Account | null>;
  findByExternalId(externalId: string): Promise<Account | null>;
  findAll(): Promise<Account[]>;
  delete(id: string): Promise<void>;
}