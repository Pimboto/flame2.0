import { randomUUID } from 'crypto';

export interface ClassInfo {
  classType: string;
  classColor: string;
}

export interface ProxyInfo {
  https: string;
}

export interface GeneralInformation {
  name: string;
  age?: number;
  phone?: string;
  email?: string;
  accountTag?: string;
  image?: string;
  location?: string;
  isVerified?: boolean;
}

export class Account {
  private constructor(
    private readonly _id: string,
    private readonly _externalId: string,
    private readonly _accountString: string,
    private readonly _accountOrigin: string,
    private readonly _classInfo: ClassInfo,
    private readonly _generalInformation: GeneralInformation,
    private readonly _proxy: ProxyInfo,
    private readonly _status: string,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(
    externalId: string,
    accountString: string,
    accountOrigin: string,
    classInfo: ClassInfo,
    generalInformation: GeneralInformation,
    proxy: ProxyInfo,
    status: string,
  ): Account {
    return new Account(
      randomUUID(),
      externalId,
      accountString,
      accountOrigin,
      classInfo,
      generalInformation,
      proxy,
      status,
      new Date(),
      new Date(),
    );
  }

  static fromData(data: {
    id?: string;
    externalId: string;
    accountString: string;
    accountOrigin: string;
    classInfo: ClassInfo;
    generalInformation: GeneralInformation;
    proxy: ProxyInfo;
    status: string;
    createdAt?: Date;
    updatedAt?: Date;
  }): Account {
    return new Account(
      data.id || randomUUID(),
      data.externalId,
      data.accountString,
      data.accountOrigin,
      data.classInfo,
      data.generalInformation,
      data.proxy,
      data.status,
      data.createdAt || new Date(),
      data.updatedAt || new Date(),
    );
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get externalId(): string {
    return this._externalId;
  }

  get accountString(): string {
    return this._accountString;
  }

  get accountOrigin(): string {
    return this._accountOrigin;
  }

  get classInfo(): ClassInfo {
    return { ...this._classInfo };
  }

  get generalInformation(): GeneralInformation {
    return { ...this._generalInformation };
  }

  get proxy(): ProxyInfo {
    return { ...this._proxy };
  }

  get status(): string {
    return this._status;
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get updatedAt(): Date {
    return new Date(this._updatedAt);
  }

  // Métodos de negocio
  isActive(): boolean {
    return this._status === 'alive';
  }

  updateLastActivity(): void {
    this._updatedAt = new Date();
  }

  // Para serialización
  toPlainObject(): any {
    return {
      id: this._id,
      externalId: this._externalId,
      accountString: this._accountString,
      accountOrigin: this._accountOrigin,
      classInfo: this._classInfo,
      generalInformation: this._generalInformation,
      proxy: this._proxy,
      status: this._status,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
