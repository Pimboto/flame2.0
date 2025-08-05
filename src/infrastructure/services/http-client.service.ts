// src/infrastructure/services/http-client.service.ts
// SERVICIO HTTP - Maneja todas las llamadas HTTP externas

import { Injectable, Logger } from '@nestjs/common';
import { IHttpClient } from '../../domain/interfaces/http-client.interface';

export interface HttpRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

@Injectable()
export class HttpClientService implements IHttpClient {
  private readonly logger = new Logger(HttpClientService.name);

  async request<T>(url: string, options: HttpRequestOptions): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeout || 30000,
    );

    try {
      this.logger.debug(`Making ${options.method} request to ${url}`);

      const response = await fetch(url, {
        method: options.method,
        headers: options.headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP Error ${response.status}: ${response.statusText}. Body: ${errorText}`,
        );
      }

      const data = await response.json();
      this.logger.debug(`Request successful: ${url}`);
      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout: ${url}`);
        }
        this.logger.error(`Request failed: ${error.message}`);
        throw error;
      }

      throw new Error('Unknown error during HTTP request');
    }
  }

  async get<T>(url: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(url, {
      method: 'GET',
      headers,
    });
  }

  async post<T>(
    url: string,
    body: any,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body,
    });
  }
}
