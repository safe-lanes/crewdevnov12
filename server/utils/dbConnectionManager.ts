import { Pool, PoolClient } from 'pg';

interface QueuedOperation<T> {
  operation: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  retryCount: number;
  maxRetries: number;
}

interface ConnectionManagerConfig {
  maxConcurrent: number;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  queueTimeoutMs: number;
}

const DEFAULT_CONFIG: ConnectionManagerConfig = {
  maxConcurrent: 10,     // Max concurrent database operations
  maxRetries: 3,         // Number of retry attempts
  baseDelayMs: 100,      // Base delay for exponential backoff
  maxDelayMs: 5000,      // Maximum delay between retries
  queueTimeoutMs: 30000, // Timeout for queued operations
};

export class DatabaseConnectionManager {
  private pool: Pool;
  private config: ConnectionManagerConfig;
  private activeOperations: number = 0;
  private queue: QueuedOperation<any>[] = [];
  private isProcessing: boolean = false;
  private metrics = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    retriedOperations: 0,
    queuedOperations: 0,
    peakConcurrent: 0,
  };

  constructor(pool: Pool, config: Partial<ConnectionManagerConfig> = {}) {
    this.pool = pool;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.pool.on('error', (err) => {
      console.error('🔴 Pool error:', err.message);
    });

    this.pool.on('connect', () => {
      console.log('🟢 New pool connection established');
    });

    this.pool.on('remove', () => {
      console.log('🟡 Pool connection removed');
    });
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateBackoff(retryCount: number): number {
    const delay = Math.min(
      this.config.baseDelayMs * Math.pow(2, retryCount) + Math.random() * 100,
      this.config.maxDelayMs
    );
    return delay;
  }

  private isRetryableError(error: any): boolean {
    const retryableCodes = [
      '53300', // too_many_connections
      '53400', // configuration_limit_exceeded
      '57P01', // admin_shutdown
      '57P02', // crash_shutdown
      '57P03', // cannot_connect_now
      '08000', // connection_exception
      '08003', // connection_does_not_exist
      '08006', // connection_failure
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
    ];
    
    const errorCode = error?.code || '';
    const errorMessage = error?.message || '';
    
    return retryableCodes.includes(errorCode) || 
           errorMessage.includes('too many clients') ||
           errorMessage.includes('ECONNRESET') ||
           errorMessage.includes('connection') ||
           errorMessage.includes('timeout');
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0 && this.activeOperations < this.config.maxConcurrent) {
      const item = this.queue.shift();
      if (!item) continue;

      this.activeOperations++;
      this.metrics.peakConcurrent = Math.max(this.metrics.peakConcurrent, this.activeOperations);

      this.executeWithRetry(item)
        .finally(() => {
          this.activeOperations--;
          this.processQueue();
        });
    }

    this.isProcessing = false;
  }

  private async executeWithRetry<T>(item: QueuedOperation<T>): Promise<void> {
    try {
      const result = await item.operation();
      this.metrics.successfulOperations++;
      item.resolve(result);
    } catch (error: any) {
      if (this.isRetryableError(error) && item.retryCount < item.maxRetries) {
        item.retryCount++;
        this.metrics.retriedOperations++;
        
        const delay = this.calculateBackoff(item.retryCount);
        console.warn(`⚠️ Retrying operation (attempt ${item.retryCount}/${item.maxRetries}) after ${delay}ms: ${error.message}`);
        
        await this.sleep(delay);
        
        this.queue.unshift(item);
        this.processQueue();
      } else {
        this.metrics.failedOperations++;
        console.error(`❌ Operation failed after ${item.retryCount} retries:`, error.message);
        item.reject(error);
      }
    }
  }

  async execute<T>(operation: () => Promise<T>, maxRetries?: number): Promise<T> {
    this.metrics.totalOperations++;

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.queue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.queue.splice(index, 1);
          reject(new Error('Operation timed out in queue'));
        }
      }, this.config.queueTimeoutMs);

      const wrappedResolve = (value: T) => {
        clearTimeout(timeoutId);
        resolve(value);
      };

      const wrappedReject = (error: Error) => {
        clearTimeout(timeoutId);
        reject(error);
      };

      const queueItem: QueuedOperation<T> = {
        operation,
        resolve: wrappedResolve,
        reject: wrappedReject,
        retryCount: 0,
        maxRetries: maxRetries ?? this.config.maxRetries,
      };

      if (this.activeOperations < this.config.maxConcurrent) {
        this.activeOperations++;
        this.metrics.peakConcurrent = Math.max(this.metrics.peakConcurrent, this.activeOperations);
        
        this.executeWithRetry(queueItem)
          .finally(() => {
            this.activeOperations--;
            this.processQueue();
          });
      } else {
        this.metrics.queuedOperations++;
        this.queue.push(queueItem);
      }
    });
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T> {
    return this.execute(async () => {
      const client = await this.pool.connect();
      try {
        const result = await client.query(sql, params);
        return result as T;
      } finally {
        client.release();
      }
    });
  }

  async withClient<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.execute(async () => {
      const client = await this.pool.connect();
      try {
        return await operation(client);
      } finally {
        client.release();
      }
    });
  }

  async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    return this.execute(async () => {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const result = await operation(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    });
  }

  getMetrics() {
    return {
      ...this.metrics,
      activeOperations: this.activeOperations,
      queueLength: this.queue.length,
      poolStats: {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount,
      },
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const startTime = Date.now();
      await this.query('SELECT 1');
      const responseTime = Date.now() - startTime;
      
      const metrics = this.getMetrics();
      const healthy = metrics.poolStats.waitingCount < 10 && 
                      this.queue.length < 50 &&
                      responseTime < 1000;
      
      return {
        healthy,
        details: {
          responseTime,
          ...metrics,
        },
      };
    } catch (error: any) {
      return {
        healthy: false,
        details: {
          error: error.message,
          ...this.getMetrics(),
        },
      };
    }
  }

  logMetrics(): void {
    const metrics = this.getMetrics();
    console.log('📊 Database Connection Manager Metrics:', JSON.stringify(metrics, null, 2));
  }
}

export function createConnectionManager(pool: Pool, config?: Partial<ConnectionManagerConfig>): DatabaseConnectionManager {
  return new DatabaseConnectionManager(pool, config);
}
