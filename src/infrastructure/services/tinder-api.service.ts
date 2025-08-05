// src/infrastructure/services/tinder-api.service.ts
// SERVICIO API TINDER - Maneja la comunicación con la API externa

import { Injectable, Logger } from '@nestjs/common';
import { HttpClientService } from './http-client.service';
import { ITinderApiService } from '../../domain/interfaces/tinder-api.interface';

export interface TinderAccount {
  account: string;
  class_info: {
    class_type: string;
    class_color: string;
  };
  account_origin: string;
}

export interface ImportTaskResponse {
  task_id: string;
  status: 'PENDING' | 'STARTED' | 'COMPLETED' | 'FAILED';
  progress?: string;
  successful?: number;
  failed?: number;
  successful_ids?: string[];
}

export interface AccountDetailsResponse {
  success: boolean;
  accounts: Array<{
    user_data: {
      id: string;
      general_information: {
        name: string;
        age?: number;
        phone?: string;
        email?: string;
        account_tag?: string;
        image?: string;
        location?: string;
        is_verified?: boolean;
      };
      class_info: {
        class_type: string;
        class_color: string;
      };
      status: string;
      proxy: {
        https: string;
      };
    };
  }>;
  total: number;
}

@Injectable()
export class TinderApiService implements ITinderApiService {
  private readonly logger = new Logger(TinderApiService.name);
  private readonly baseUrl = 'https://api.flamebot-tin.com';

  constructor(private readonly httpClient: HttpClientService) {}

  async importAccounts(
    accounts: TinderAccount[],
    apiToken: string,
  ): Promise<ImportTaskResponse> {
    if (!apiToken) {
      throw new Error('API token is required for importing accounts');
    }

    this.logger.log(`Importing ${accounts.length} accounts`);

    return await this.httpClient.post<ImportTaskResponse>(
      `${this.baseUrl}/api/add-tinder-cards`,
      { accounts },
      {
        Authorization: `Bearer ${apiToken}`,
      },
    );
  }

  async getTaskStatus(
    taskId: string,
    apiToken: string,
  ): Promise<ImportTaskResponse> {
    if (!apiToken) {
      throw new Error('API token is required for getting task status');
    }

    return await this.httpClient.get<ImportTaskResponse>(
      `${this.baseUrl}/api/get-add-tinder-cards-status/${taskId}`,
      {
        Authorization: `Bearer ${apiToken}`,
      },
    );
  }

  async getAccountsByIds(
    accountIds: string[],
    apiToken: string,
  ): Promise<AccountDetailsResponse> {
    if (!apiToken) {
      throw new Error('API token is required for getting account details');
    }

    if (accountIds.length === 0) {
      return {
        success: true,
        accounts: [],
        total: 0,
      };
    }

    this.logger.log(`Fetching details for ${accountIds.length} accounts`);

    return await this.httpClient.post<AccountDetailsResponse>(
      `${this.baseUrl}/api/get-tinder-accounts-by-ids`,
      accountIds,
      {
        Authorization: `Bearer ${apiToken}`,
      },
    );
  }
}
