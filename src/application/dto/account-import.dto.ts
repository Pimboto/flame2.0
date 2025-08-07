// src/application/dto/account-import.dto.ts

export class AccountImportDto {
  executionId!: string;
  accountCount!: number;
  status!: string;
  message!: string;
  startedAt!: Date;
}
