// src/application/use-cases/import-accounts/process-import-task.use-case.ts

import { Injectable, Logger, Inject } from '@nestjs/common';
import { ITinderApiService } from '../../../domain/interfaces/tinder-api.interface';
import { IAccountRepository } from '../../../domain/interfaces/account.repository.interface';
import { Account } from '../../../domain/entities/account.entity';

export interface ProcessImportTaskCommand {
  taskId: string;
  apiToken: string;
  accounts: Array<{
    account: string;
    class_info: {
      class_type: string;
      class_color: string;
    };
    account_origin: string;
  }>;
  maxAttempts?: number;
}

@Injectable()
export class ProcessImportTaskUseCase {
  private readonly logger = new Logger(ProcessImportTaskUseCase.name);

  constructor(
    @Inject('ITinderApiService')
    private readonly tinderApiService: ITinderApiService,
    @Inject('IAccountRepository')
    private readonly accountRepository: IAccountRepository,
  ) {}

  async execute(command: ProcessImportTaskCommand): Promise<any> {
    const maxAttempts = command.maxAttempts || 150;
    let attemptCount = 0;

    // Poll for task status
    while (attemptCount < maxAttempts) {
      attemptCount++;
      this.logger.log(
        `Checking import status - Attempt ${attemptCount}/${maxAttempts}`,
      );

      const statusResponse = await this.tinderApiService.getTaskStatus(
        command.taskId,
        command.apiToken,
      );

      if (statusResponse.status === 'COMPLETED') {
        return await this.processCompletedImport(
          statusResponse,
          command.accounts,
          command.apiToken,
        );
      }

      if (statusResponse.status === 'FAILED') {
        throw new Error('Import task failed');
      }

      // Wait before next attempt
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }

    throw new Error('Import task timeout - exceeded maximum attempts');
  }

  private async processCompletedImport(
    statusResponse: any,
    originalAccounts: any[],
    apiToken: string,
  ): Promise<any> {
    const successfulCount = statusResponse.successful || 0;
    const failedCount = statusResponse.failed || 0;
    const successfulIds = statusResponse.successful_ids || [];

    this.logger.log(
      `Import completed - Success: ${successfulCount}, Failed: ${failedCount}`,
    );

    if (successfulCount === 0) {
      return {
        success: false,
        message: 'No accounts were imported successfully',
        summary: {
          totalProcessed: originalAccounts.length,
          successful: 0,
          failed: failedCount,
          saved: 0,
        },
      };
    }

    // Fetch account details
    const detailsResponse = await this.tinderApiService.getAccountsByIds(
      successfulIds,
      apiToken,
    );

    if (!detailsResponse.success) {
      throw new Error('Failed to fetch account details');
    }

    // Map and save accounts
    const savedAccounts = await this.saveImportedAccounts(
      detailsResponse.accounts,
      originalAccounts,
    );

    return {
      success: true,
      message: `Successfully imported ${savedAccounts.length} accounts`,
      summary: {
        totalProcessed: originalAccounts.length,
        successful: successfulCount,
        failed: failedCount,
        saved: savedAccounts.length,
      },
      accounts: savedAccounts,
    };
  }

  private async saveImportedAccounts(
    accountDetails: any[],
    originalAccounts: any[],
  ): Promise<any[]> {
    const domainAccounts = accountDetails.map((detail, index) => {
      const original = originalAccounts[index] || originalAccounts[0];

      return Account.create(
        detail.user_data.id,
        original?.account || '',
        original?.account_origin || 'unknown',
        {
          classType: detail.user_data.class_info.class_type,
          classColor: detail.user_data.class_info.class_color,
        },
        {
          name: detail.user_data.general_information.name,
          age: detail.user_data.general_information.age,
          phone: detail.user_data.general_information.phone,
          email: detail.user_data.general_information.email,
          accountTag: detail.user_data.general_information.account_tag,
          image: detail.user_data.general_information.image,
          location: detail.user_data.general_information.location,
          isVerified: detail.user_data.general_information.is_verified,
        },
        {
          https: detail.user_data.proxy.https,
        },
        detail.user_data.status,
      );
    });

    await this.accountRepository.saveMany(domainAccounts);

    this.logger.log(`Saved ${domainAccounts.length} accounts to database`);

    return domainAccounts.map((acc) => acc.toPlainObject());
  }
}
