import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../domain/entities/account.entity';
import { IAccountRepository } from '../../domain/repositories/account.repository.interface';
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

  async findAll(): Promise<Account[]> {
    const entities = await this.accountRepository.find();
    return entities.map((entity) => this.toDomain(entity));
  }

  async delete(id: string): Promise<void> {
    await this.accountRepository.delete(id);
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
    return Account.create(
      entity.externalId,
      entity.accountString,
      entity.accountOrigin,
      {
        classType: entity.classType,
        classColor: entity.classColor,
      },
      {
        name: entity.name,
        age: entity.age,
        phone: entity.phone,
        email: entity.email,
        accountTag: entity.accountTag,
        image: entity.image,
        location: entity.location,
        isVerified: entity.isVerified,
      },
      {
        https: entity.proxyHttps,
      },
      entity.status,
    );
  }
}
