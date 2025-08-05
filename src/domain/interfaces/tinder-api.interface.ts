// src/domain/interfaces/tinder-api.interface.ts
// INTERFACE - Contrato para el servicio de API Tinder

export interface ITinderApiService {
  importAccounts(accounts: any[], apiToken: string): Promise<any>;
  getTaskStatus(taskId: string, apiToken: string): Promise<any>;
  getAccountsByIds(accountIds: string[], apiToken: string): Promise<any>;
}
