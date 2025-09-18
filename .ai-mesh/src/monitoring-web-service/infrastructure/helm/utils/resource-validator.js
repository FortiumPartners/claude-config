/**
 * Resource Validator - Enhanced for Task 3.2
 * 
 * Comprehensive resource validation for Kubernetes deployments:
 * - Resource quota and limit validation
 * - CPU and memory requirement verification
 * - Storage capacity and availability checks
 * - Node resource assessment
 * 
 * Part of: Phase 2 - Week 5 - Sprint 3: Deployment Automation
 * Task: 3.2 Pre-deployment Validation Enhancement
 */

/**
 * Resource Validator Class
 * 
 * Validates resource requirements and availability for deployments
 */
class ResourceValidator {
  constructor(config = {}) {
    this.config = {
      defaultCpuRequest: config.defaultCpuRequest || '100m',
      defaultMemoryRequest: config.defaultMemoryRequest || '128Mi',
      defaultCpuLimit: config.defaultCpuLimit || '500m',
      defaultMemoryLimit: config.defaultMemoryLimit || '512Mi',
      resourceBuffer: config.resourceBuffer || 0.2, // 20% buffer
      ...config
    };
  }

  /**
   * Validate resource requirements against available resources
   */
  async validateResourceRequirements(requirements, availableResources) {
    const validation = {
      passed: true,
      issues: [],
      warnings: [],
      recommendations: []
    };

    // CPU validation
    if (requirements.cpu) {
      const cpuCheck = this._validateCpuRequirement(requirements.cpu, availableResources.cpu);
      if (!cpuCheck.passed) {
        validation.passed = false;
        validation.issues.push(cpuCheck);
      } else if (cpuCheck.warning) {
        validation.warnings.push(cpuCheck);
      }
    }

    // Memory validation
    if (requirements.memory) {
      const memoryCheck = this._validateMemoryRequirement(requirements.memory, availableResources.memory);
      if (!memoryCheck.passed) {
        validation.passed = false;
        validation.issues.push(memoryCheck);
      } else if (memoryCheck.warning) {
        validation.warnings.push(memoryCheck);
      }
    }

    // Storage validation
    if (requirements.storage) {
      const storageCheck = this._validateStorageRequirement(requirements.storage, availableResources.storage);
      if (!storageCheck.passed) {
        validation.passed = false;
        validation.issues.push(storageCheck);
      }
    }

    return validation;
  }

  /**
   * Validate resource quotas and limits
   */
  async validateResourceQuotas(quotas, usage) {
    const validation = {
      passed: true,
      issues: [],
      warnings: [],
      utilization: {}
    };

    Object.entries(quotas).forEach(([resource, quota]) => {
      const currentUsage = usage[resource] || 0;
      const utilization = quota.hard !== Infinity ? (currentUsage / quota.hard) : 0;
      
      validation.utilization[resource] = {
        used: currentUsage,
        hard: quota.hard,
        utilization: utilization * 100
      };

      // Check if quota is exceeded
      if (currentUsage >= quota.hard && quota.hard !== Infinity) {
        validation.passed = false;
        validation.issues.push({
          resource,
          message: `Resource quota exceeded for ${resource}`,
          used: currentUsage,
          limit: quota.hard,
          severity: 'error'
        });
      }
      // Warn if usage is high
      else if (utilization > 0.8) {
        validation.warnings.push({
          resource,
          message: `High utilization for ${resource} (${Math.round(utilization * 100)}%)`,
          used: currentUsage,
          limit: quota.hard,
          severity: 'warning'
        });
      }
    });

    return validation;
  }

  /**
   * Check resource availability across cluster nodes
   */
  async validateNodeResources(nodes, requirements) {
    const validation = {
      passed: false,
      availableNodes: [],
      insufficientNodes: [],
      totalAvailable: { cpu: 0, memory: 0 },
      recommendations: []
    };

    nodes.forEach(node => {
      const allocatable = node.status.allocatable || {};
      const capacity = node.status.capacity || {};
      
      const availableCpu = this._parseResourceValue(allocatable.cpu || '0');
      const availableMemory = this._parseResourceValue(allocatable.memory || '0');
      
      const totalCpu = this._parseResourceValue(capacity.cpu || '0');
      const totalMemory = this._parseResourceValue(capacity.memory || '0');

      validation.totalAvailable.cpu += availableCpu;
      validation.totalAvailable.memory += availableMemory;

      const nodeInfo = {
        name: node.metadata.name,
        ready: this._isNodeReady(node),
        availableCpu,
        availableMemory,
        totalCpu,
        totalMemory,
        canSchedule: false
      };

      // Check if node can accommodate requirements
      if (nodeInfo.ready) {
        const requiredCpu = this._parseResourceValue(requirements.cpu || this.config.defaultCpuRequest);
        const requiredMemory = this._parseResourceValue(requirements.memory || this.config.defaultMemoryRequest);

        if (availableCpu >= requiredCpu && availableMemory >= requiredMemory) {
          nodeInfo.canSchedule = true;
          validation.availableNodes.push(nodeInfo);
          validation.passed = true;
        } else {
          validation.insufficientNodes.push({
            ...nodeInfo,
            shortfall: {
              cpu: Math.max(0, requiredCpu - availableCpu),
              memory: Math.max(0, requiredMemory - availableMemory)
            }
          });
        }
      }
    });

    // Generate recommendations
    if (!validation.passed) {
      validation.recommendations.push(
        'Consider reducing resource requests or adding more cluster capacity'
      );
    }

    if (validation.availableNodes.length === 1) {
      validation.recommendations.push(
        'Consider adding more nodes for high availability'
      );
    }

    return validation;
  }

  /**
   * Validate persistent volume requirements
   */
  async validateStorageRequirements(requirements, availableStorage) {
    const validation = {
      passed: true,
      issues: [],
      warnings: [],
      recommendations: []
    };

    if (requirements.persistentVolumes) {
      for (const pvRequest of requirements.persistentVolumes) {
        const requiredSize = this._parseResourceValue(pvRequest.size);
        const storageClass = pvRequest.storageClass;

        // Check if storage class exists
        const availableClass = availableStorage.storageClasses.find(sc => 
          sc.metadata.name === storageClass
        );

        if (!availableClass && storageClass) {
          validation.passed = false;
          validation.issues.push({
            type: 'storage-class',
            message: `Storage class '${storageClass}' not found`,
            storageClass,
            severity: 'error'
          });
        }

        // Check available capacity
        const availableCapacity = availableStorage.availableCapacity || 0;
        if (requiredSize > availableCapacity) {
          validation.passed = false;
          validation.issues.push({
            type: 'capacity',
            message: `Insufficient storage capacity (required: ${this._formatBytes(requiredSize)}, available: ${this._formatBytes(availableCapacity)})`,
            required: requiredSize,
            available: availableCapacity,
            severity: 'error'
          });
        }
      }
    }

    return validation;
  }

  // Private helper methods

  _validateCpuRequirement(requirement, available) {
    const required = this._parseResourceValue(requirement);
    const availableCpu = available || Infinity;
    
    if (required > availableCpu) {
      return {
        passed: false,
        message: `Insufficient CPU (required: ${requirement}, available: ${this._formatCpu(availableCpu)})`,
        required,
        available: availableCpu,
        severity: 'error'
      };
    }

    // Warning if using more than 80% of available CPU
    if (availableCpu !== Infinity && (required / availableCpu) > 0.8) {
      return {
        passed: true,
        warning: true,
        message: `High CPU utilization (${Math.round((required / availableCpu) * 100)}%)`,
        required,
        available: availableCpu,
        severity: 'warning'
      };
    }

    return {
      passed: true,
      message: 'CPU requirement satisfied',
      required,
      available: availableCpu
    };
  }

  _validateMemoryRequirement(requirement, available) {
    const required = this._parseResourceValue(requirement);
    const availableMemory = available || Infinity;
    
    if (required > availableMemory) {
      return {
        passed: false,
        message: `Insufficient memory (required: ${requirement}, available: ${this._formatBytes(availableMemory)})`,
        required,
        available: availableMemory,
        severity: 'error'
      };
    }

    // Warning if using more than 80% of available memory
    if (availableMemory !== Infinity && (required / availableMemory) > 0.8) {
      return {
        passed: true,
        warning: true,
        message: `High memory utilization (${Math.round((required / availableMemory) * 100)}%)`,
        required,
        available: availableMemory,
        severity: 'warning'
      };
    }

    return {
      passed: true,
      message: 'Memory requirement satisfied',
      required,
      available: availableMemory
    };
  }

  _validateStorageRequirement(requirement, available) {
    const required = this._parseResourceValue(requirement);
    const availableStorage = available || Infinity;
    
    if (required > availableStorage) {
      return {
        passed: false,
        message: `Insufficient storage (required: ${requirement}, available: ${this._formatBytes(availableStorage)})`,
        required,
        available: availableStorage,
        severity: 'error'
      };
    }

    return {
      passed: true,
      message: 'Storage requirement satisfied',
      required,
      available: availableStorage
    };
  }

  _parseResourceValue(value) {
    if (typeof value === 'number') return value;
    if (!value || typeof value !== 'string') return 0;

    const numericValue = parseFloat(value);
    
    // Handle CPU units (millicores)
    if (value.endsWith('m')) {
      return numericValue / 1000; // millicores to cores
    }
    
    // Handle memory/storage units
    const units = {
      'Ki': 1024,
      'Mi': 1024 ** 2,
      'Gi': 1024 ** 3,
      'Ti': 1024 ** 4,
      'K': 1000,
      'M': 1000 ** 2,
      'G': 1000 ** 3,
      'T': 1000 ** 4
    };
    
    for (const [unit, multiplier] of Object.entries(units)) {
      if (value.endsWith(unit)) {
        return numericValue * multiplier;
      }
    }
    
    return numericValue;
  }

  _formatCpu(cores) {
    if (cores === Infinity) return 'unlimited';
    if (cores < 1) return `${Math.round(cores * 1000)}m`;
    return `${cores.toFixed(2)} cores`;
  }

  _formatBytes(bytes) {
    if (bytes === Infinity) return 'unlimited';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)}${units[unitIndex]}`;
  }

  _isNodeReady(node) {
    const conditions = node.status.conditions || [];
    const readyCondition = conditions.find(condition => condition.type === 'Ready');
    return readyCondition && readyCondition.status === 'True';
  }
}

module.exports = { ResourceValidator };