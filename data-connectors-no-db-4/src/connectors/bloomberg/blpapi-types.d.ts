declare module 'blpapi' {
  export class Session {
    constructor(config: { host: string; port: number });
    on(event: string, callback: (message: any) => void): void;
    openService(serviceName: string, serviceId: number): void;
    subscribe(securities: any[]): void;
    request(
      service: string,
      requestType: string,
      params: any,
      correlationId: number,
      identity?: any
    ): void;
    authorizeUser(params: any, correlationId: number): void;
    destroy(): void;
  }
}
