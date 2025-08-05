// src/domain/interfaces/http-client.interface.ts
// INTERFACE - Contrato para cliente HTTP (sin implementación)

export interface IHttpClient {
  get<T>(url: string, headers?: Record<string, string>): Promise<T>;
  post<T>(url: string, body: any, headers?: Record<string, string>): Promise<T>;
}
