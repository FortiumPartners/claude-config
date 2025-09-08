"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KafkaManager = void 0;
exports.getDefaultKafkaConfig = getDefaultKafkaConfig;
const kafkajs_1 = require("kafkajs");
class KafkaManager {
    kafka;
    logger;
    config;
    topics = {
        METRICS_RAW: 'fortium.metrics.raw',
        METRICS_PROCESSED: 'fortium.metrics.processed',
        METRICS_AGGREGATED: 'fortium.metrics.aggregated',
        METRICS_ALERTS: 'fortium.metrics.alerts',
        METRICS_DLQ: 'fortium.metrics.dlq'
    };
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        const kafkaConfig = {
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
            logLevel: process.env.NODE_ENV === 'development' ? 2 : 1,
        };
        this.kafka = new kafkajs_1.Kafka(kafkaConfig);
    }
    getKafka() {
        return this.kafka;
    }
    createProducer(config) {
        const defaultConfig = {
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
    createConsumer(groupId, config) {
        const defaultConfig = {
            groupId,
            sessionTimeout: 30000,
            rebalanceTimeout: 60000,
            heartbeatInterval: 3000,
            maxBytesPerPartition: 1048576,
            minBytes: 1,
            maxBytes: 10485760,
            maxWaitTimeInMs: 5000,
            retry: {
                initialRetryTime: 100,
                retries: 8
            },
            readUncommitted: false,
            ...config
        };
        const consumer = this.kafka.consumer(defaultConfig);
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
            }
            else {
                this.logger.info('All Kafka topics already exist');
            }
        }
        catch (error) {
            this.logger.error('Failed to initialize Kafka topics', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
        finally {
            await admin.disconnect();
        }
    }
    getPartitionCount(topicName) {
        switch (topicName) {
            case this.topics.METRICS_RAW:
                return 12;
            case this.topics.METRICS_PROCESSED:
                return 6;
            case this.topics.METRICS_AGGREGATED:
                return 3;
            case this.topics.METRICS_ALERTS:
                return 3;
            case this.topics.METRICS_DLQ:
                return 1;
            default:
                return 3;
        }
    }
    getReplicationFactor() {
        return process.env.NODE_ENV === 'production' ? 3 : 1;
    }
    getTopicConfig(topicName) {
        const baseConfig = [
            { name: 'cleanup.policy', value: 'delete' },
            { name: 'compression.type', value: 'snappy' },
            { name: 'min.insync.replicas', value: '1' }
        ];
        switch (topicName) {
            case this.topics.METRICS_RAW:
                return [
                    ...baseConfig,
                    { name: 'retention.ms', value: '604800000' },
                    { name: 'segment.ms', value: '86400000' },
                    { name: 'batch.size', value: '16384' },
                    { name: 'linger.ms', value: '5' }
                ];
            case this.topics.METRICS_PROCESSED:
                return [
                    ...baseConfig,
                    { name: 'retention.ms', value: '2592000000' },
                    { name: 'segment.ms', value: '86400000' }
                ];
            case this.topics.METRICS_AGGREGATED:
                return [
                    ...baseConfig,
                    { name: 'retention.ms', value: '7776000000' },
                    { name: 'segment.ms', value: '604800000' }
                ];
            case this.topics.METRICS_ALERTS:
                return [
                    ...baseConfig,
                    { name: 'retention.ms', value: '2592000000' },
                    { name: 'segment.ms', value: '86400000' }
                ];
            case this.topics.METRICS_DLQ:
                return [
                    ...baseConfig,
                    { name: 'retention.ms', value: '604800000' },
                    { name: 'segment.ms', value: '86400000' }
                ];
            default:
                return baseConfig;
        }
    }
    async healthCheck() {
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
        }
        catch (error) {
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
exports.KafkaManager = KafkaManager;
function getDefaultKafkaConfig() {
    const brokers = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];
    const clientId = process.env.KAFKA_CLIENT_ID || 'fortium-metrics-service';
    const config = {
        brokers,
        clientId,
        connectionTimeout: 10000,
        requestTimeout: 30000,
        retry: {
            initialRetryTime: 100,
            retries: 8
        }
    };
    if (process.env.KAFKA_SSL === 'true') {
        config.ssl = true;
    }
    if (process.env.KAFKA_SASL_MECHANISM) {
        config.sasl = {
            mechanism: process.env.KAFKA_SASL_MECHANISM,
            username: process.env.KAFKA_SASL_USERNAME || '',
            password: process.env.KAFKA_SASL_PASSWORD || ''
        };
    }
    return config;
}
//# sourceMappingURL=kafka.config.js.map