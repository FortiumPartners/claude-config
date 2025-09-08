import { Kafka, ProducerConfig, ConsumerConfig } from 'kafkajs';
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
    METRICS_DLQ: string;
}
export declare class KafkaManager {
    private kafka;
    private logger;
    private config;
    readonly topics: KafkaTopics;
    constructor(config: MetricsKafkaConfig, logger: winston.Logger);
    getKafka(): Kafka;
    createProducer(config?: Partial<ProducerConfig>): import("kafkajs").Producer;
    createConsumer(groupId: string, config?: Partial<ConsumerConfig>): import("kafkajs").Consumer;
    createAdmin(): import("kafkajs").Admin;
    initializeTopics(): Promise<void>;
    private getPartitionCount;
    private getReplicationFactor;
    private getTopicConfig;
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: any;
    }>;
}
export declare function getDefaultKafkaConfig(): MetricsKafkaConfig;
//# sourceMappingURL=kafka.config.d.ts.map