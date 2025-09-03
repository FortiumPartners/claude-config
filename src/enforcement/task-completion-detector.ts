import { CommandExecutionRecord, TaskProgress, ValidationResult } from './types';
import { SessionStateManager } from './session-state-manager';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Task 3.5: Implement task completion detection from command execution
 * 
 * Detects task completion based on:
 * 1. Command execution results
 * 2. File system changes (tasks.md updates)
 * 3. Git commit messages
 * 4. Output analysis
 */
export class TaskCompletionDetector {
  constructor(private sessionManager: SessionStateManager) {}

  /**
   * Analyze command execution to detect task completion
   */
  public async analyzeCommandExecution(
    sessionId: string, 
    command: string, 
    result: any, 
    outputs?: string[]
  ): Promise<TaskCompletion[]> {
    const completions: TaskCompletion[] = [];

    // Analyze based on command type
    switch (command) {
      case '/execute-tasks':
        completions.push(...await this.detectExecuteTasksCompletion(sessionId, result, outputs));
        break;
      case '/plan-product':
        completions.push(...await this.detectPlanningCompletion(sessionId, result));
        break;
      case '/analyze-product':
        completions.push(...await this.detectAnalysisCompletion(sessionId, result));
        break;
      case '/fold-prompt':
        completions.push(...await this.detectOptimizationCompletion(sessionId, result));
        break;
    }

    // Update session state with detected completions
    for (const completion of completions) {
      await this.sessionManager.markTaskComplete(sessionId, completion.taskDescription);
    }

    return completions;
  }

  /**
   * Monitor file system changes to detect task completion
   */
  public async monitorFileChanges(sessionId: string, workingDirectory: string): Promise<TaskCompletion[]> {
    const completions: TaskCompletion[] = [];

    try {
      // Check for tasks.md updates
      const tasksFile = await this.findTasksFile(workingDirectory);
      if (tasksFile) {
        const markdownCompletions = await this.analyzeTasksMarkdown(tasksFile);
        completions.push(...markdownCompletions);
      }

      // Check for recent git commits
      const gitCompletions = await this.analyzeGitCommits(workingDirectory);
      completions.push(...gitCompletions);

    } catch (error) {
      console.warn('Error monitoring file changes:', error);
    }

    return completions;
  }

  /**
   * Analyze command outputs to detect completion signals
   */
  public analyzeOutputPatterns(outputs: string[]): TaskCompletion[] {
    const completions: TaskCompletion[] = [];
    const completionPatterns = [
      /task\s+(.+?)\s+completed/i,
      /✅\s*(.+)/i,
      /finished\s+(.+)/i,
      /done\s+with\s+(.+)/i,
      /successfully\s+(.+)/i,
      /implemented\s+(.+)/i
    ];

    for (const output of outputs) {
      for (const pattern of completionPatterns) {
        const match = output.match(pattern);
        if (match && match[1]) {
          completions.push({
            taskDescription: match[1].trim(),
            completionType: 'OUTPUT_ANALYSIS',
            confidence: 0.8,
            evidence: output,
            timestamp: new Date()
          });
        }
      }
    }

    return completions;
  }

  private async detectExecuteTasksCompletion(
    sessionId: string, 
    result: any, 
    outputs?: string[]
  ): Promise<TaskCompletion[]> {
    const completions: TaskCompletion[] = [];

    if (result.success) {
      // Extract task description from session state
      const session = await this.sessionManager.getSession(sessionId);
      const recentTasks = Array.from(session.taskProgress.values())
        .filter(t => t.status === 'in-progress')
        .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());

      if (recentTasks.length > 0) {
        const latestTask = recentTasks[0];
        completions.push({
          taskDescription: latestTask.description,
          completionType: 'COMMAND_SUCCESS',
          confidence: 0.9,
          evidence: 'Command executed successfully',
          timestamp: new Date()
        });
      }

      // Analyze outputs for completion signals
      if (outputs) {
        completions.push(...this.analyzeOutputPatterns(outputs));
      }
    }

    return completions;
  }

  private async detectPlanningCompletion(sessionId: string, result: any): Promise<TaskCompletion[]> {
    const completions: TaskCompletion[] = [];

    if (result.success) {
      completions.push({
        taskDescription: 'Product planning',
        completionType: 'PLANNING_COMPLETE',
        confidence: 1.0,
        evidence: 'Planning command completed successfully',
        timestamp: new Date()
      });

      await this.sessionManager.markPlanningComplete(sessionId);
    }

    return completions;
  }

  private async detectAnalysisCompletion(sessionId: string, result: any): Promise<TaskCompletion[]> {
    const completions: TaskCompletion[] = [];

    if (result.success) {
      completions.push({
        taskDescription: 'Product analysis',
        completionType: 'ANALYSIS_COMPLETE',
        confidence: 1.0,
        evidence: 'Analysis command completed successfully',
        timestamp: new Date()
      });

      await this.sessionManager.markAnalysisComplete(sessionId);
    }

    return completions;
  }

  private async detectOptimizationCompletion(sessionId: string, result: any): Promise<TaskCompletion[]> {
    const completions: TaskCompletion[] = [];

    if (result.success) {
      completions.push({
        taskDescription: 'Project optimization',
        completionType: 'OPTIMIZATION_COMPLETE',
        confidence: 0.9,
        evidence: 'Optimization command completed successfully',
        timestamp: new Date()
      });
    }

    return completions;
  }

  private async findTasksFile(workingDirectory: string): Promise<string | null> {
    const possiblePaths = [
      path.join(workingDirectory, '.agent-os', 'specs'),
      path.join(workingDirectory, 'tasks.md'),
      path.join(workingDirectory, 'spec.md')
    ];

    for (const searchPath of possiblePaths) {
      try {
        if (searchPath.endsWith('specs')) {
          // Look for tasks.md in spec directories
          const specs = await fs.readdir(searchPath, { withFileTypes: true });
          for (const spec of specs) {
            if (spec.isDirectory()) {
              const tasksPath = path.join(searchPath, spec.name, 'tasks.md');
              try {
                await fs.access(tasksPath);
                return tasksPath;
              } catch {
                // Continue searching
              }
            }
          }
        } else {
          await fs.access(searchPath);
          return searchPath;
        }
      } catch {
        // Continue searching
      }
    }

    return null;
  }

  private async analyzeTasksMarkdown(filePath: string): Promise<TaskCompletion[]> {
    const completions: TaskCompletion[] = [];

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        const completedTaskMatch = line.match(/^[\s]*[-*]\s*\[x\]\s*(.+)/);
        if (completedTaskMatch) {
          completions.push({
            taskDescription: completedTaskMatch[1].trim(),
            completionType: 'MARKDOWN_UPDATE',
            confidence: 1.0,
            evidence: `Task marked complete in ${filePath}`,
            timestamp: new Date()
          });
        }
      }
    } catch (error) {
      console.warn(`Error analyzing tasks markdown at ${filePath}:`, error);
    }

    return completions;
  }

  private async analyzeGitCommits(workingDirectory: string): Promise<TaskCompletion[]> {
    const completions: TaskCompletion[] = [];

    try {
      // This would require git integration - for now, return empty array
      // In production, would analyze recent commit messages for completion signals
      return completions;
    } catch (error) {
      console.warn('Error analyzing git commits:', error);
      return completions;
    }
  }
}

export interface TaskCompletion {
  taskDescription: string;
  completionType: 'COMMAND_SUCCESS' | 'MARKDOWN_UPDATE' | 'OUTPUT_ANALYSIS' | 'GIT_COMMIT' | 
                  'PLANNING_COMPLETE' | 'ANALYSIS_COMPLETE' | 'OPTIMIZATION_COMPLETE';
  confidence: number; // 0.0 to 1.0
  evidence: string;
  timestamp: Date;
}