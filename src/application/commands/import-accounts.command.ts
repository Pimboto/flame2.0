// src/application/commands/import-accounts.command.ts

export interface AccountData {
  account: string;
  class_info: {
    class_type: string;
    class_color: string;
  };
  account_origin: string;
}

export class ImportAccountsCommand {
  constructor(
    public readonly accounts: AccountData[],
    public readonly apiToken: string,
    public readonly userId?: string,
  ) {}
}
