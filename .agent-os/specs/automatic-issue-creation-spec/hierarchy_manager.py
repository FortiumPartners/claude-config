#!/usr/bin/env python3
"""
Hierarchical issue creation and management logic.

This module provides sophisticated algorithms for creating and managing
hierarchical issue relationships across different ticketing systems.
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime

from issue_spec import IssueSpec, IssueHierarchy, IssueType
from ticketing_interface import (
    TicketingInterface, CreatedIssue, TicketingInterfaceException,
    TicketingSystem
)


class CreationStrategy(Enum):
    """Strategies for creating hierarchical issues."""
    TOP_DOWN = "top_down"           # Create parents first, then children
    BOTTOM_UP = "bottom_up"         # Create children first, then parents
    BREADTH_FIRST = "breadth_first" # Create by hierarchy level
    DEPTH_FIRST = "depth_first"     # Create entire subtrees at once
    PARALLEL = "parallel"           # Create independent issues in parallel


@dataclass
class CreationOrder:
    """Represents the order in which issues should be created."""
    batches: List[List[IssueSpec]] = field(default_factory=list)
    dependencies: Dict[str, List[str]] = field(default_factory=dict)  # issue_id -> dependent_ids
    
    def add_batch(self, issues: List[IssueSpec]):
        """Add a batch of issues that can be created in parallel."""
        self.batches.append(issues)
    
    def add_dependency(self, issue_id: str, dependent_ids: List[str]):
        """Add dependency information."""
        self.dependencies[issue_id] = dependent_ids
    
    def get_total_count(self) -> int:
        """Get total number of issues to be created."""
        return sum(len(batch) for batch in self.batches)


@dataclass
class CreationProgress:
    """Tracks progress of hierarchical issue creation."""
    total_issues: int = 0
    created_count: int = 0
    failed_count: int = 0
    current_batch: int = 0
    total_batches: int = 0
    
    # Mapping from spec ID to created issue
    spec_to_created: Dict[str, CreatedIssue] = field(default_factory=dict)
    creation_errors: Dict[str, Exception] = field(default_factory=dict)
    
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    
    @property
    def elapsed_time(self) -> float:
        """Get elapsed time in seconds."""
        if not self.start_time:
            return 0.0
        end = self.end_time or datetime.now()
        return (end - self.start_time).total_seconds()
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate."""
        total = self.created_count + self.failed_count
        return (self.created_count / total * 100) if total > 0 else 0.0
    
    @property
    def is_complete(self) -> bool:
        """Check if creation is complete."""
        return (self.created_count + self.failed_count) >= self.total_issues


class HierarchyManager:
    """
    Manages hierarchical issue creation with support for different strategies
    and error recovery across various ticketing systems.
    """
    
    def __init__(self, ticketing_interface: TicketingInterface, 
                 strategy: CreationStrategy = CreationStrategy.TOP_DOWN):
        self.ticketing = ticketing_interface
        self.strategy = strategy
        self.logger = logging.getLogger(__name__)
        
        # System-specific optimizations
        self.system_type = ticketing_interface.system_type
        self.supports_native_hierarchy = self._check_native_hierarchy_support()
        
        # Progress tracking
        self.progress: Optional[CreationProgress] = None
    
    def _check_native_hierarchy_support(self) -> bool:
        """Check if the ticketing system supports native parent-child relationships."""
        # Linear supports native hierarchy well
        if self.system_type == TicketingSystem.LINEAR:
            return True
        
        # GitHub has limited hierarchy support (mainly through references)
        if self.system_type == TicketingSystem.GITHUB:
            return False
        
        # Default to assuming basic hierarchy support
        return True
    
    async def create_hierarchy(self, hierarchy: IssueHierarchy, 
                             progress_callback: Optional[callable] = None) -> List[CreatedIssue]:
        """
        Create a complete issue hierarchy using the configured strategy.
        
        Args:
            hierarchy: The issue hierarchy to create
            progress_callback: Optional callback for progress updates
            
        Returns:
            List of all created issues
        """
        self.progress = CreationProgress(
            total_issues=hierarchy.total_count(),
            start_time=datetime.now()
        )
        
        try:
            self.logger.info(
                f"Creating hierarchy with {hierarchy.total_count()} issues "
                f"using {self.strategy.value} strategy"
            )
            
            # Determine creation order based on strategy
            creation_order = self._plan_creation_order(hierarchy)
            self.progress.total_batches = len(creation_order.batches)
            
            # Execute creation plan
            created_issues = await self._execute_creation_plan(
                creation_order, hierarchy, progress_callback
            )
            
            # Establish cross-references and relationships
            await self._establish_relationships(created_issues, hierarchy)
            
            self.logger.info(
                f"Hierarchy creation complete: {len(created_issues)} issues created "
                f"in {self.progress.elapsed_time:.2f}s"
            )
            
            return created_issues
            
        except Exception as e:
            self.logger.error(f"Hierarchy creation failed: {e}")
            raise
        
        finally:
            if self.progress:
                self.progress.end_time = datetime.now()
    
    def _plan_creation_order(self, hierarchy: IssueHierarchy) -> CreationOrder:
        """Plan the order of issue creation based on strategy."""
        order = CreationOrder()
        
        if self.strategy == CreationStrategy.TOP_DOWN:
            order = self._plan_top_down_creation(hierarchy)
        
        elif self.strategy == CreationStrategy.BOTTOM_UP:
            order = self._plan_bottom_up_creation(hierarchy)
        
        elif self.strategy == CreationStrategy.BREADTH_FIRST:
            order = self._plan_breadth_first_creation(hierarchy)
        
        elif self.strategy == CreationStrategy.DEPTH_FIRST:
            order = self._plan_depth_first_creation(hierarchy)
        
        elif self.strategy == CreationStrategy.PARALLEL:
            order = self._plan_parallel_creation(hierarchy)
        
        else:
            # Default to top-down
            order = self._plan_top_down_creation(hierarchy)
        
        self.logger.debug(f"Planned {len(order.batches)} creation batches")
        return order
    
    def _plan_top_down_creation(self, hierarchy: IssueHierarchy) -> CreationOrder:
        """Plan top-down creation: parents first, then children."""
        order = CreationOrder()
        
        # Group issues by depth level
        levels: Dict[int, List[IssueSpec]] = {}
        
        for issue in hierarchy.all_issues.values():
            depth = issue.get_depth()
            if depth not in levels:
                levels[depth] = []
            levels[depth].append(issue)
        
        # Create batches in order of increasing depth
        for depth in sorted(levels.keys()):
            order.add_batch(levels[depth])
            
            # Add dependency information
            for issue in levels[depth]:
                if issue.parent:
                    order.add_dependency(issue.id, [issue.parent.id])
        
        return order
    
    def _plan_bottom_up_creation(self, hierarchy: IssueHierarchy) -> CreationOrder:
        """Plan bottom-up creation: children first, then parents."""
        order = CreationOrder()
        
        # Group issues by depth level
        levels: Dict[int, List[IssueSpec]] = {}
        
        for issue in hierarchy.all_issues.values():
            depth = issue.get_depth()
            if depth not in levels:
                levels[depth] = []
            levels[depth].append(issue)
        
        # Create batches in order of decreasing depth
        for depth in sorted(levels.keys(), reverse=True):
            order.add_batch(levels[depth])
            
            # Add reverse dependency information
            for issue in levels[depth]:
                if issue.children:
                    order.add_dependency(issue.id, [child.id for child in issue.children])
        
        return order
    
    def _plan_breadth_first_creation(self, hierarchy: IssueHierarchy) -> CreationOrder:
        """Plan breadth-first creation: create all issues at each level together."""
        return self._plan_top_down_creation(hierarchy)  # Same as top-down
    
    def _plan_depth_first_creation(self, hierarchy: IssueHierarchy) -> CreationOrder:
        """Plan depth-first creation: create complete subtrees."""
        order = CreationOrder()
        
        # Process each root issue and its complete subtree
        for root_issue in hierarchy.root_issues:
            subtree_issues = self._get_subtree_issues(root_issue)
            order.add_batch(subtree_issues)
        
        return order
    
    def _plan_parallel_creation(self, hierarchy: IssueHierarchy) -> CreationOrder:
        """Plan parallel creation: maximize parallelism while respecting dependencies."""
        order = CreationOrder()
        
        # Find issues with no dependencies (can be created in parallel)
        independent_issues = []
        dependent_issues = []
        
        for issue in hierarchy.all_issues.values():
            if issue.parent is None:
                independent_issues.append(issue)
            else:
                dependent_issues.append(issue)
        
        # First batch: all independent issues
        if independent_issues:
            order.add_batch(independent_issues)
        
        # Subsequent batches: group by dependency level
        remaining = dependent_issues
        while remaining:
            next_batch = []
            still_waiting = []
            
            for issue in remaining:
                # Check if parent would be created in previous batches
                parent_ready = True
                if issue.parent and issue.parent not in independent_issues:
                    # Check if parent is in any previous batch
                    parent_ready = any(
                        issue.parent in batch 
                        for batch in order.batches
                    )
                
                if parent_ready:
                    next_batch.append(issue)
                else:
                    still_waiting.append(issue)
            
            if next_batch:
                order.add_batch(next_batch)
                remaining = still_waiting
            else:
                # If no progress can be made, fall back to top-down
                for issue in still_waiting:
                    order.add_batch([issue])
                break
        
        return order
    
    def _get_subtree_issues(self, root_issue: IssueSpec) -> List[IssueSpec]:
        """Get all issues in a subtree starting from root."""
        issues = [root_issue]
        
        for child in root_issue.children:
            issues.extend(self._get_subtree_issues(child))
        
        return issues
    
    async def _execute_creation_plan(self, creation_order: CreationOrder, 
                                   hierarchy: IssueHierarchy,
                                   progress_callback: Optional[callable]) -> List[CreatedIssue]:
        """Execute the creation plan batch by batch."""
        all_created_issues = []
        
        for batch_index, batch in enumerate(creation_order.batches):
            self.progress.current_batch = batch_index + 1
            
            self.logger.info(
                f"Creating batch {batch_index + 1}/{len(creation_order.batches)} "
                f"with {len(batch)} issues"
            )
            
            # Create issues in current batch
            batch_results = await self._create_issue_batch(batch, creation_order.dependencies)
            all_created_issues.extend(batch_results)
            
            # Update progress
            for result in batch_results:
                if result:
                    self.progress.created_count += 1
                    if result.original_spec:
                        self.progress.spec_to_created[result.original_spec.id] = result
                else:
                    self.progress.failed_count += 1
            
            # Call progress callback
            if progress_callback:
                try:
                    await progress_callback(self.progress)
                except Exception as e:
                    self.logger.warning(f"Progress callback failed: {e}")
            
            self.logger.info(
                f"Batch {batch_index + 1} complete: "
                f"{len([r for r in batch_results if r])} created, "
                f"{len([r for r in batch_results if not r])} failed"
            )
        
        return [issue for issue in all_created_issues if issue is not None]
    
    async def _create_issue_batch(self, batch: List[IssueSpec], 
                                dependencies: Dict[str, List[str]]) -> List[Optional[CreatedIssue]]:
        """Create a batch of issues, handling dependencies and parallel creation."""
        if not batch:
            return []
        
        # For systems with good hierarchy support, create issues with parent references
        if self.supports_native_hierarchy:
            return await self._create_batch_with_native_hierarchy(batch)
        else:
            # For systems without native hierarchy, create issues and link manually
            return await self._create_batch_with_manual_linking(batch)
    
    async def _create_batch_with_native_hierarchy(self, batch: List[IssueSpec]) -> List[Optional[CreatedIssue]]:
        """Create batch using native hierarchy support."""
        results = []
        
        # Create issues sequentially to respect parent-child relationships
        for issue_spec in batch:
            try:
                # Find parent issue ID if exists
                parent_id = None
                if issue_spec.parent and self.progress:
                    parent_created = self.progress.spec_to_created.get(issue_spec.parent.id)
                    if parent_created:
                        parent_id = parent_created.id
                
                # Create the issue
                created_issue = await self.ticketing.create_issue(issue_spec, parent_id)
                created_issue.original_spec = issue_spec
                results.append(created_issue)
                
                self.logger.debug(f"Created issue: {created_issue.title} (ID: {created_issue.id})")
                
            except Exception as e:
                self.logger.error(f"Failed to create issue '{issue_spec.title}': {e}")
                if self.progress:
                    self.progress.creation_errors[issue_spec.id] = e
                results.append(None)
        
        return results
    
    async def _create_batch_with_manual_linking(self, batch: List[IssueSpec]) -> List[Optional[CreatedIssue]]:
        """Create batch and manually establish links."""
        # Create all issues in parallel first
        create_tasks = []
        for issue_spec in batch:
            task = asyncio.create_task(self._create_single_issue(issue_spec))
            create_tasks.append(task)
        
        # Wait for all creations to complete
        results = await asyncio.gather(*create_tasks, return_exceptions=True)
        
        # Process results and handle exceptions
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                issue_spec = batch[i]
                self.logger.error(f"Failed to create issue '{issue_spec.title}': {result}")
                if self.progress:
                    self.progress.creation_errors[issue_spec.id] = result
                processed_results.append(None)
            else:
                processed_results.append(result)
        
        return processed_results
    
    async def _create_single_issue(self, issue_spec: IssueSpec) -> CreatedIssue:
        """Create a single issue without parent reference."""
        created_issue = await self.ticketing.create_issue(issue_spec)
        created_issue.original_spec = issue_spec
        return created_issue
    
    async def _establish_relationships(self, created_issues: List[CreatedIssue], 
                                     hierarchy: IssueHierarchy):
        """Establish relationships between created issues."""
        if self.supports_native_hierarchy:
            # Native hierarchy was handled during creation
            return
        
        self.logger.info("Establishing manual issue relationships...")
        
        # Create mapping from spec ID to created issue
        spec_to_created = {}
        for created_issue in created_issues:
            if created_issue.original_spec:
                spec_to_created[created_issue.original_spec.id] = created_issue
        
        # Establish parent-child links through comments/references
        relationship_tasks = []
        
        for spec_issue in hierarchy.all_issues.values():
            if spec_issue.parent and spec_issue.id in spec_to_created:
                parent_created = spec_to_created.get(spec_issue.parent.id)
                child_created = spec_to_created.get(spec_issue.id)
                
                if parent_created and child_created:
                    task = asyncio.create_task(
                        self.ticketing.link_issues(parent_created.id, child_created.id)
                    )
                    relationship_tasks.append(task)
        
        # Execute relationship establishment
        if relationship_tasks:
            results = await asyncio.gather(*relationship_tasks, return_exceptions=True)
            
            success_count = sum(1 for result in results if result is True)
            failure_count = len(results) - success_count
            
            self.logger.info(
                f"Relationship establishment complete: "
                f"{success_count} successful, {failure_count} failed"
            )
    
    def get_creation_summary(self) -> Dict[str, Any]:
        """Get a summary of the creation process."""
        if not self.progress:
            return {"status": "not_started"}
        
        return {
            "status": "complete" if self.progress.is_complete else "in_progress",
            "total_issues": self.progress.total_issues,
            "created": self.progress.created_count,
            "failed": self.progress.failed_count,
            "success_rate": self.progress.success_rate,
            "elapsed_time": self.progress.elapsed_time,
            "strategy": self.strategy.value,
            "batches_completed": self.progress.current_batch,
            "total_batches": self.progress.total_batches,
            "errors": len(self.progress.creation_errors)
        }


# Utility functions

def choose_optimal_strategy(hierarchy: IssueHierarchy, system_type: TicketingSystem) -> CreationStrategy:
    """Choose the optimal creation strategy based on hierarchy and system characteristics."""
    
    # Simple hierarchies work well with top-down
    if hierarchy.total_count() <= 10:
        return CreationStrategy.TOP_DOWN
    
    # For systems with good hierarchy support
    if system_type == TicketingSystem.LINEAR:
        return CreationStrategy.TOP_DOWN
    
    # For systems with limited hierarchy support
    if system_type == TicketingSystem.GITHUB:
        # Use parallel creation since we'll establish relationships manually anyway
        return CreationStrategy.PARALLEL
    
    # Complex hierarchies might benefit from depth-first
    max_depth = max(issue.get_depth() for issue in hierarchy.all_issues.values())
    if max_depth > 3:
        return CreationStrategy.DEPTH_FIRST
    
    # Default to top-down
    return CreationStrategy.TOP_DOWN


async def create_hierarchy_with_progress(hierarchy: IssueHierarchy, 
                                       ticketing_interface: TicketingInterface,
                                       progress_callback: Optional[callable] = None) -> List[CreatedIssue]:
    """Convenience function to create hierarchy with optimal strategy and progress tracking."""
    
    # Choose optimal strategy
    strategy = choose_optimal_strategy(hierarchy, ticketing_interface.system_type)
    
    # Create hierarchy manager
    manager = HierarchyManager(ticketing_interface, strategy)
    
    # Execute creation
    return await manager.create_hierarchy(hierarchy, progress_callback)