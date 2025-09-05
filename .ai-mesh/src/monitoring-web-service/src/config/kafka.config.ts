/**
 * Kafka Configuration for Real-Time Metrics Processing
 * Task 3.3: Kafka configuration and connection management
 */

import { Kafka, KafkaConfig, ProducerConfig, ConsumerConfig } from 'kafkajs';
import * as winston from 'winston';

export interface MetricsKafkaConfig {
  brokers: string[];
  clientId: string;
  ssl?: boolean;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
  connectionTimeout?: number;
  requestTimeout?: number;
  retry?: {
    initialRetryTime: number;
    retries: number;
  };
}

export interface KafkaTopics {
  METRICS_RAW: string;
  METRICS_PROCESSED: string;
  METRICS_AGGREGATED: string;
  METRICS_ALERTS: string;
  METRICS_DLQ: string; // Dead Letter Queue
}

export class KafkaManager {
  private kafka: Kafka;
  private logger: winston.Logger;
  private config: MetricsKafkaConfig;

  public readonly topics: KafkaTopics = {
    METRICS_RAW: 'fortium.metrics.raw',
    METRICS_PROCESSED: 'fortium.metrics.processed',
    METRICS_AGGREGATED: 'fortium.metrics.aggregated',
    METRICS_ALERTS: 'fortium.metrics.alerts',
    METRICS_DLQ: 'fortium.metrics.dlq'
  };

  constructor(config: MetricsKafkaConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;

    const kafkaConfig: KafkaConfig = {
      clientId: config.clientId,
      brokers: config.brokers,
      ssl: config.ssl,
      sasl: config.sasl,
      connectionTimeout: config.connectionTimeout || 10000,
      requestTimeout: config.requestTimeout || 30000,
      retry: {
        initialRetryTime: config.retry?.initialRetryTime || 100,
        retries: config.retry?.retries || 8
      },
      logLevel: process.env.NODE_ENV === 'development' ? 2 : 1, // WARN in prod, INFO in dev
    };

    this.kafka = new Kafka(kafkaConfig);
  }

  /**
   * Get Kafka instance
   */
  getKafka(): Kafka {
    return this.kafka;
  }

  /**
   * Create producer for metrics ingestion
   */
  createProducer(config?: Partial<ProducerConfig>) {
    const defaultConfig: ProducerConfig = {
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000,
      retry: {
        initialRetryTime: 100,
        retries: 5
      },
      ...config
    };

    const producer = this.kafka.producer(defaultConfig);

    // Add error handling
    producer.on('producer.connect', () => {
      this.logger.info('Kafka producer connected');
    });

    producer.on('producer.disconnect', () => {
      this.logger.warn('Kafka producer disconnected');
    });

    producer.on('producer.network.request_timeout', (payload) => {
      this.logger.error('Kafka producer request timeout', payload);
    });

    return producer;
  }

  /**
   * Create consumer for metrics processing
   */
  createConsumer(groupId: string, config?: Partial<ConsumerConfig>) {
    const defaultConfig: ConsumerConfig = {
      groupId,
      sessionTimeout: 30000,
      rebalanceTimeout: 60000,
      heartbeatInterval: 3000,
      maxBytesPerPartition: 1048576, // 1MB
      minBytes: 1,
      maxBytes: 10485760, // 10MB
      maxWaitTimeInMs: 5000,
      retry: {
        initialRetryTime: 100,
        retries: 8
      },
      readUncommitted: false,
      ...config
    };

    const consumer = this.kafka.consumer(defaultConfig);

    // Add error handling
    consumer.on('consumer.connect', () => {
      this.logger.info(`Kafka consumer connected: ${groupId}`);
    });

    consumer.on('consumer.disconnect', () => {
      this.logger.warn(`Kafka consumer disconnected: ${groupId}`);
    });

    consumer.on('consumer.crash', (payload) => {
      this.logger.error(`Kafka consumer crashed: ${groupId}`, payload);
    });

    consumer.on('consumer.rebalancing', () => {
      this.logger.info(`Kafka consumer rebalancing: ${groupId}`);
    });

    return consumer;
  }

  /**
   * Create admin client for topic management
   */
  createAdmin() {
    const admin = this.kafka.admin();

    admin.on('admin.connect', () => {
      this.logger.info('Kafka admin connected');
    });

    admin.on('admin.disconnect', () => {
      this.logger.info('Kafka admin disconnected');
    });

    return admin;
  }

  /**
   * Initialize all required topics
   */
  async initializeTopics() {
    const admin = this.createAdmin();
    
    try {
      await admin.connect();
      
      const existingTopics = await admin.listTopics();
      const topicsToCreate = [];

      for (const topicName of Object.values(this.topics)) {
        if (!existingTopics.includes(topicName)) {
          topicsToCreate.push({
            topic: topicName,
            numPartitions: this.getPartitionCount(topicName),
            replicationFactor: this.getReplicationFactor(),
            configEntries: this.getTopicConfig(topicName)
          });
        }
      }

      if (topicsToCreate.length > 0) {
        await admin.createTopics({
          topics: topicsToCreate,
          waitForLeaders: true,
          timeout: 30000
        });

        this.logger.info('Created Kafka topics', {
          topics: topicsToCreate.map(t => t.topic)
        });
      } else {
        this.logger.info('All Kafka topics already exist');
      }

    } catch (error) {
      this.logger.error('Failed to initialize Kafka topics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      await admin.disconnect();
    }
  }

  /**
   * Get partition count for a topic based on expected load
   */
  private getPartitionCount(topicName: string): number {
    switch (topicName) {
      case this.topics.METRICS_RAW:
        return 12; // High throughput ingestion
      case this.topics.METRICS_PROCESSED:
        return 6;  // Medium throughput processing
      case this.topics.METRICS_AGGREGATED:
        return 3;  // Lower throughput aggregation
      case this.topics.METRICS_ALERTS:
        return 3;  // Low throughput alerts
      case this.topics.METRICS_DLQ:
        return 1;  // Dead letter queue
      default:
        return 3;  // Default
    }
  }

  /**
   * Get replication factor based on environment
   */
  private getReplicationFactor(): number {
    return process.env.NODE_ENV === 'production' ? 3 : 1;
  }

  /**
   * Get topic-specific configuration
   */
  private getTopicConfig(topicName: string): Array<{ name: string; value: string }> {
    const baseConfig = [
      { name: 'cleanup.policy', value: 'delete' },
      { name: 'compression.type', value: 'snappy' },
      { name: 'min.insync.replicas', value: '1' }
    ];

    switch (topicName) {
      case this.topics.METRICS_RAW:
        return [
          ...baseConfig,
          { name: 'retention.ms', value: '604800000' }, // 7 days
          { name: 'segment.ms', value: '86400000' }, // 1 day
          { name: 'batch.size', value: '16384' }, // 16KB
          { name: 'linger.ms', value: '5' } // 5ms batching
        ];
      
      case this.topics.METRICS_PROCESSED:
        return [
          ...baseConfig,
          { name: 'retention.ms', value: '2592000000' }, // 30 days
          { name: 'segment.ms', value: '86400000' } // 1 day
        ];
      
      case this.topics.METRICS_AGGREGATED:
        return [
          ...baseConfig,
          { name: 'retention.ms', value: '7776000000' }, // 90 days
          { name: 'segment.ms', value: '604800000' } // 7 days
        ];
      
      case this.topics.METRICS_ALERTS:
        return [
          ...baseConfig,
          { name: 'retention.ms', value: '2592000000' }, // 30 days
          { name: 'segment.ms', value: '86400000' } // 1 day
        ];
      
      case this.topics.METRICS_DLQ:
        return [
          ...baseConfig,
          { name: 'retention.ms', value: '604800000' }, // 7 days
          { name: 'segment.ms', value: '86400000' } // 1 day
        ];
      
      default:
        return baseConfig;
    }
  }

  /**
   * Health check for Kafka connectivity
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    const admin = this.createAdmin();
    
    try {
      await admin.connect();
      
      const metadata = await admin.fetchTopicMetadata({
        topics: Object.values(this.topics)
      });
      
      await admin.disconnect();
      
      return {
        status: 'healthy',
        details: {
          brokers: this.config.brokers,
          topics: metadata.topics.map(t => ({
            name: t.name,
            partitions: t.partitions.length,
            leader_available: t.partitions.every(p => p.leader >= 0)
          }))
        }
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          brokers: this.config.brokers
        }
      };
    }
  }
}

/**
 * Default Kafka configuration based on environment
 */
export function getDefaultKafkaConfig(): MetricsKafkaConfig {
  const brokers = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];
  const clientId = process.env.KAFKA_CLIENT_ID || 'fortium-metrics-service';
  
  const config: MetricsKafkaConfig = {
    brokers,
    clientId,
    connectionTimeout: 10000,
    requestTimeout: 30000,
    retry: {
      initialRetryTime: 100,
      retries: 8
    }
  };

  // Add SSL configuration for production
  if (process.env.KAFKA_SSL === 'true') {
    config.ssl = true;
  }

  // Add SASL authentication if configured
  if (process.env.KAFKA_SASL_MECHANISM) {
    config.sasl = {
      mechanism: process.env.KAFKA_SASL_MECHANISM as any,
      username: process.env.KAFKA_SASL_USERNAME || '',
      password: process.env.KAFKA_SASL_PASSWORD || ''
    };
  }

  return config;
}