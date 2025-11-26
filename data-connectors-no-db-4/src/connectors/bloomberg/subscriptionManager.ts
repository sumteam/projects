export interface SecuritySubscription {
  security: string;
  fields: string[];
  options?: Record<string, any>;
}

export class SubscriptionManager {
  private subscriptions: Map<number, SecuritySubscription> = new Map();
  private nextCorrelationId: number = 0;
  private securityToCorrelation: Map<string, number> = new Map();

  addSubscription(security: string, fields: string[], options?: Record<string, any>): number {
    const correlationId = this.nextCorrelationId++;

    const subscription: SecuritySubscription = {
      security,
      fields,
      options: options || {},
    };

    this.subscriptions.set(correlationId, subscription);
    this.securityToCorrelation.set(security, correlationId);

    return correlationId;
  }

  getSubscription(correlationId: number): SecuritySubscription | undefined {
    return this.subscriptions.get(correlationId);
  }

  getSecurityByCorrelation(correlationId: number): string | null {
    const subscription = this.subscriptions.get(correlationId);
    return subscription ? subscription.security : null;
  }

  getCorrelationBySecurity(security: string): number | null {
    return this.securityToCorrelation.get(security) || null;
  }

  getAllSubscriptions(): SecuritySubscription[] {
    return Array.from(this.subscriptions.values());
  }

  buildBloombergSubscriptions(): any[] {
    const result: any[] = [];

    for (const [correlationId, sub] of this.subscriptions) {
      result.push({
        security: sub.security,
        correlation: correlationId,
        fields: sub.fields,
        options: sub.options,
      });
    }

    return result;
  }

  removeSubscription(security: string): boolean {
    const correlationId = this.securityToCorrelation.get(security);

    if (correlationId === undefined) {
      return false;
    }

    this.subscriptions.delete(correlationId);
    this.securityToCorrelation.delete(security);

    return true;
  }

  clear(): void {
    this.subscriptions.clear();
    this.securityToCorrelation.clear();
    this.nextCorrelationId = 0;
  }

  size(): number {
    return this.subscriptions.size;
  }
}
