// src/application/use-cases/import-accounts/import-accounts.use-case.ts

import { Injectable, Logger, Inject } from '@nestjs/common';
import { ImportAccountsCommand } from '../../commands/import-accounts.command';
import { ProcessImportTaskUseCase } from './process-import-task.use-case';
import { ITinderApiService } from '../../../domain/interfaces/tinder-api.interface';
import { AccountImportDto } from '../../dto/account-import.dto';

@Injectable()
export class ImportAccountsUseCase {
  private readonly logger = new Logger(ImportAccountsUseCase.name);

  constructor(
    @Inject('ITinderApiService')
    private readonly tinderApiService: ITinderApiService,
    private readonly processImportTaskUseCase: ProcessImportTaskUseCase,
  ) {}

  async execute(command: ImportAccountsCommand): Promise<AccountImportDto> {
    this.logger.log(`Starting import of ${command.accounts.length} accounts`);

    // Step 1: Initiate import with external API
    const importResponse = await this.tinderApiService.importAccounts(
      command.accounts,
      command.apiToken,
    );

    const taskId = importResponse.task_id;
    this.logger.log(`Import task created: ${taskId}`);

    // Step 2: Process the import task (polling and saving)
    const result = await this.processImportTaskUseCase.execute({
      taskId,
      apiToken: command.apiToken,
      accounts: command.accounts,
    });

    return {
      executionId: taskId,
      accountCount: command.accounts.length,
      status: result.success ? 'completed' : 'failed',
      message: result.message,
      startedAt: new Date(),
    };
  }
}
