// src/infrastructure/repositories/account.repository.ts
// ACTUALIZADO - Para usar la interface correcta

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Account } from '../../domain/entities/account.entity';
import { IAccountRepository } from '../../domain/interfaces/account.repository.interface';
import { AccountEntity } from '../entities/account.entity';

@Injectable()
export class AccountRepository implements IAccountRepository {
  constructor(
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
  ) {}

  async save(account: Account): Promise<void> {
    const accountEntity = this.toEntity(account);
    await this.accountRepository.save(accountEntity);
  }

  async saveMany(accounts: Account[]): Promise<void> {
    const accountEntities = accounts.map((account) => this.toEntity(account));
    await this.accountRepository.save(accountEntities);
  }

  async findById(id: string): Promise<Account | null> {
    const entity = await this.accountRepository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByExternalId(externalId: string): Promise<Account | null> {
    const entity = await this.accountRepository.findOne({
      where: { externalId },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByExternalIds(externalIds: string[]): Promise<Account[]> {
    const entities = await this.accountRepository.find({
      where: { externalId: In(externalIds) },
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  async findAll(): Promise<Account[]> {
    const entities = await this.accountRepository.find();
    return entities.map((entity) => this.toDomain(entity));
  }

  async findByStatus(status: string): Promise<Account[]> {
    const entities = await this.accountRepository.find({
      where: { status },
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  async update(id: string, updateData: Partial<Account>): Promise<void> {
    await this.accountRepository.update(id, updateData as any);
  }

  async delete(id: string): Promise<void> {
    await this.accountRepository.delete(id);
  }

  async count(): Promise<number> {
    return await this.accountRepository.count();
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.accountRepository.count({ where: { id } });
    return count > 0;
  }

  private toEntity(account: Account): AccountEntity {
    const plainObject = account.toPlainObject();

    const entity = new AccountEntity();
    entity.id = plainObject.id;
    entity.externalId = plainObject.externalId;
    entity.accountString = plainObject.accountString;
    entity.accountOrigin = plainObject.accountOrigin;
    entity.classType = plainObject.classInfo.classType;
    entity.classColor = plainObject.classInfo.classColor;
    entity.name = plainObject.generalInformation.name;
    entity.age = plainObject.generalInformation.age;
    entity.phone = plainObject.generalInformation.phone;
    entity.email = plainObject.generalInformation.email;
    entity.accountTag = plainObject.generalInformation.accountTag;
    entity.image = plainObject.generalInformation.image;
    entity.location = plainObject.generalInformation.location;
    entity.isVerified = plainObject.generalInformation.isVerified || false;
    entity.proxyHttps = plainObject.proxy.https;
    entity.status = plainObject.status;
    entity.createdAt = plainObject.createdAt;
    entity.updatedAt = plainObject.updatedAt;

    return entity;
  }

  private toDomain(entity: AccountEntity): Account {
    return Account.fromData({
      id: entity.id,
      externalId: entity.externalId,
      accountString: entity.accountString,
      accountOrigin: entity.accountOrigin,
      classInfo: {
        classType: entity.classType,
        classColor: entity.classColor,
      },
      generalInformation: {
        name: entity.name,
        age: entity.age,
        phone: entity.phone,
        email: entity.email,
        accountTag: entity.accountTag,
        image: entity.image,
        location: entity.location,
        isVerified: entity.isVerified,
      },
      proxy: {
        https: entity.proxyHttps,
      },
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }
}
