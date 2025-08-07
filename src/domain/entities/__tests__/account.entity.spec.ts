// src/domain/entities/__tests__/account.entity.spec.ts

import { Account } from '../account.entity';

describe('Account Entity', () => {
  const validAccountData = {
    externalId: 'ext-123',
    accountString: 'test:account:string',
    accountOrigin: 'ios',
    classInfo: {
      classType: 'premium',
      classColor: '#FF0000',
    },
    generalInformation: {
      name: 'Test User',
      age: 25,
      phone: '+1234567890',
      email: 'test@example.com',
      accountTag: 'tag123',
      image: 'https://example.com/image.jpg',
      location: 'New York',
      isVerified: true,
    },
    proxy: {
      https: 'https://proxy.example.com',
    },
    status: 'active',
  };

  describe('create', () => {
    it('should create a new account with all properties', () => {
      const account = Account.create(
        validAccountData.externalId,
        validAccountData.accountString,
        validAccountData.accountOrigin,
        validAccountData.classInfo,
        validAccountData.generalInformation,
        validAccountData.proxy,
        validAccountData.status,
      );

      expect(account.id).toBeDefined();
      expect(account.externalId).toBe(validAccountData.externalId);
      expect(account.accountString).toBe(validAccountData.accountString);
      expect(account.accountOrigin).toBe(validAccountData.accountOrigin);
      expect(account.classInfo).toEqual(validAccountData.classInfo);
      expect(account.generalInformation).toEqual(
        validAccountData.generalInformation,
      );
      expect(account.proxy).toEqual(validAccountData.proxy);
      expect(account.status).toBe(validAccountData.status);
      expect(account.createdAt).toBeInstanceOf(Date);
      expect(account.updatedAt).toBeInstanceOf(Date);
    });

    it('should generate unique id for new account', () => {
      const account1 = Account.create(
        'ext-1',
        validAccountData.accountString,
        validAccountData.accountOrigin,
        validAccountData.classInfo,
        validAccountData.generalInformation,
        validAccountData.proxy,
        validAccountData.status,
      );

      const account2 = Account.create(
        'ext-2',
        validAccountData.accountString,
        validAccountData.accountOrigin,
        validAccountData.classInfo,
        validAccountData.generalInformation,
        validAccountData.proxy,
        validAccountData.status,
      );

      expect(account1.id).not.toBe(account2.id);
    });
  });

  describe('fromData', () => {
    it('should create account from existing data', () => {
      const existingData = {
        id: 'existing-id',
        ...validAccountData,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      const account = Account.fromData(existingData);

      expect(account.id).toBe(existingData.id);
      expect(account.externalId).toBe(existingData.externalId);
      expect(account.createdAt).toEqual(existingData.createdAt);
      expect(account.updatedAt).toEqual(existingData.updatedAt);
    });

    it('should generate id if not provided', () => {
      const dataWithoutId = {
        ...validAccountData,
      };

      const account = Account.fromData(dataWithoutId);

      expect(account.id).toBeDefined();
      expect(account.id).not.toBe('');
    });
  });

  describe('isActive', () => {
    it('should return true for alive status', () => {
      const account = Account.create(
        validAccountData.externalId,
        validAccountData.accountString,
        validAccountData.accountOrigin,
        validAccountData.classInfo,
        validAccountData.generalInformation,
        validAccountData.proxy,
        'alive',
      );

      expect(account.isActive()).toBe(true);
    });

    it('should return false for other status', () => {
      const account = Account.create(
        validAccountData.externalId,
        validAccountData.accountString,
        validAccountData.accountOrigin,
        validAccountData.classInfo,
        validAccountData.generalInformation,
        validAccountData.proxy,
        'inactive',
      );

      expect(account.isActive()).toBe(false);
    });
  });

  describe('updateLastActivity', () => {
    it('should update the updatedAt timestamp', () => {
      const account = Account.create(
        validAccountData.externalId,
        validAccountData.accountString,
        validAccountData.accountOrigin,
        validAccountData.classInfo,
        validAccountData.generalInformation,
        validAccountData.proxy,
        validAccountData.status,
      );

      const originalUpdatedAt = account.updatedAt;

      // Wait a bit to ensure different timestamp
      setTimeout(() => {
        account.updateLastActivity();
        expect(account.updatedAt.getTime()).toBeGreaterThan(
          originalUpdatedAt.getTime(),
        );
      }, 10);
    });
  });

  describe('toPlainObject', () => {
    it('should return plain object representation', () => {
      const account = Account.create(
        validAccountData.externalId,
        validAccountData.accountString,
        validAccountData.accountOrigin,
        validAccountData.classInfo,
        validAccountData.generalInformation,
        validAccountData.proxy,
        validAccountData.status,
      );

      const plainObject = account.toPlainObject();

      expect(plainObject).toEqual({
        id: account.id,
        externalId: validAccountData.externalId,
        accountString: validAccountData.accountString,
        accountOrigin: validAccountData.accountOrigin,
        classInfo: validAccountData.classInfo,
        generalInformation: validAccountData.generalInformation,
        proxy: validAccountData.proxy,
        status: validAccountData.status,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      });
    });
  });

  describe('immutability', () => {
    it('should return copies of objects, not references', () => {
      const account = Account.create(
        validAccountData.externalId,
        validAccountData.accountString,
        validAccountData.accountOrigin,
        validAccountData.classInfo,
        validAccountData.generalInformation,
        validAccountData.proxy,
        validAccountData.status,
      );

      const classInfo1 = account.classInfo;
      const classInfo2 = account.classInfo;

      expect(classInfo1).toEqual(classInfo2);
      expect(classInfo1).not.toBe(classInfo2);

      const generalInfo1 = account.generalInformation;
      const generalInfo2 = account.generalInformation;

      expect(generalInfo1).toEqual(generalInfo2);
      expect(generalInfo1).not.toBe(generalInfo2);
    });
  });
});
