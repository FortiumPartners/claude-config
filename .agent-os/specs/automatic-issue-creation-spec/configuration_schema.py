#!/usr/bin/env python3
"""
Team configuration schema for automatic issue creation.

Defines YAML schema structure for team-specific and project-specific configurations.
"""

from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field, asdict
from enum import Enum
import json
try:
    import yaml
    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False
    yaml = None
from pathlib import Path


class IssueTemplateType(Enum):
    """Supported issue template types."""
    EPIC = "epic"
    FEATURE = "feature" 
    STORY = "story"
    TASK = "task"
    BUG = "bug"
    IMPROVEMENT = "improvement"


@dataclass
class IssueTemplate:
    """Configuration for issue templates."""
    title_prefix: Optional[str] = None
    title_suffix: Optional[str] = None
    labels: List[str] = field(default_factory=list)
    default_assignee: Optional[str] = None
    priority_mapping: Dict[str, str] = field(default_factory=dict)
    description_template: Optional[str] = None
    custom_fields: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TicketingSystemConfig:
    """Configuration for a specific ticketing system."""
    system_type: str  # "linear", "github", "jira", etc.
    enabled: bool = True
    
    # Common configuration
    default_labels: List[str] = field(default_factory=list)
    default_assignee: Optional[str] = None
    
    # System-specific configuration
    # Linear
    team_id: Optional[str] = None
    workspace_id: Optional[str] = None
    
    # GitHub
    repository_owner: Optional[str] = None
    repository_name: Optional[str] = None
    
    # Jira
    project_key: Optional[str] = None
    board_id: Optional[str] = None
    
    # Generic fields for extensibility
    custom_config: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AutomaticIssueCreationConfig:
    """Main configuration for automatic issue creation."""
    enabled: bool = True
    dry_run: bool = False
    default_ticketing_system: str = "linear"
    
    # Feature flags
    use_advanced_detection: bool = True
    apply_templates: bool = True
    update_spec_with_links: bool = True
    create_summary_report: bool = True
    
    # Limits and constraints
    max_issues_per_spec: int = 100
    processing_timeout: int = 300  # seconds
    
    # Quality settings
    minimum_description_length: int = 10
    require_acceptance_criteria: bool = False
    validate_issue_hierarchy: bool = True


@dataclass
class TeamConfiguration:
    """Complete team configuration schema."""
    # Version and metadata
    schema_version: str = "1.0"
    team_name: str = ""
    last_updated: Optional[str] = None
    
    # Main configuration sections
    automatic_issue_creation: AutomaticIssueCreationConfig = field(default_factory=AutomaticIssueCreationConfig)
    ticketing_systems: Dict[str, TicketingSystemConfig] = field(default_factory=dict)
    templates: Dict[str, IssueTemplate] = field(default_factory=dict)
    
    # Project overrides (optional)
    project_overrides: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    
    def __post_init__(self):
        """Initialize with default templates if none provided."""
        if not self.templates:
            self.templates = self._create_default_templates()
    
    def _create_default_templates(self) -> Dict[str, IssueTemplate]:
        """Create default issue templates."""
        return {
            IssueTemplateType.EPIC.value: IssueTemplate(
                title_prefix="[EPIC]",
                labels=["epic", "planning"],
                priority_mapping={"P1": "urgent", "P2": "high", "P3": "medium", "P4": "low"}
            ),
            IssueTemplateType.FEATURE.value: IssueTemplate(
                title_prefix="[FEATURE]",
                labels=["feature", "development"],
                priority_mapping={"P1": "urgent", "P2": "high", "P3": "medium", "P4": "low"}
            ),
            IssueTemplateType.STORY.value: IssueTemplate(
                title_prefix="[STORY]",
                labels=["story", "user-story"],
                priority_mapping={"P1": "urgent", "P2": "high", "P3": "medium", "P4": "low"}
            ),
            IssueTemplateType.TASK.value: IssueTemplate(
                title_prefix="[TASK]",
                labels=["task", "implementation"],
                priority_mapping={"P1": "urgent", "P2": "high", "P3": "medium", "P4": "low"}
            ),
            IssueTemplateType.BUG.value: IssueTemplate(
                title_prefix="[BUG]",
                labels=["bug", "fix"],
                priority_mapping={"P1": "urgent", "P2": "high", "P3": "medium", "P4": "low"}
            ),
            IssueTemplateType.IMPROVEMENT.value: IssueTemplate(
                title_prefix="[IMPROVEMENT]",
                labels=["improvement", "enhancement"],
                priority_mapping={"P1": "urgent", "P2": "high", "P3": "medium", "P4": "low"}
            )
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary."""
        return asdict(self)
    
    def to_yaml(self) -> str:
        """Convert configuration to YAML string."""
        if not YAML_AVAILABLE:
            raise ImportError("PyYAML is required for YAML support. Install with: pip install PyYAML")
        return yaml.dump(self.to_dict(), default_flow_style=False, indent=2)
    
    def to_json(self) -> str:
        """Convert configuration to JSON string."""
        return json.dumps(self.to_dict(), indent=2)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TeamConfiguration':
        """Create configuration from dictionary."""
        # Handle nested dataclass conversion
        if 'automatic_issue_creation' in data:
            data['automatic_issue_creation'] = AutomaticIssueCreationConfig(**data['automatic_issue_creation'])
        
        if 'ticketing_systems' in data:
            ticketing_systems = {}
            for name, config in data['ticketing_systems'].items():
                ticketing_systems[name] = TicketingSystemConfig(**config)
            data['ticketing_systems'] = ticketing_systems
        
        if 'templates' in data:
            templates = {}
            for name, template in data['templates'].items():
                templates[name] = IssueTemplate(**template)
            data['templates'] = templates
        
        return cls(**data)
    
    @classmethod
    def from_yaml(cls, yaml_content: str) -> 'TeamConfiguration':
        """Create configuration from YAML string."""
        if not YAML_AVAILABLE:
            raise ImportError("PyYAML is required for YAML support. Install with: pip install PyYAML")
        data = yaml.safe_load(yaml_content)
        return cls.from_dict(data)
    
    @classmethod
    def from_json(cls, json_content: str) -> 'TeamConfiguration':
        """Create configuration from JSON string."""
        data = json.loads(json_content)
        return cls.from_dict(data)
    
    @classmethod
    def from_file(cls, file_path: Union[str, Path]) -> 'TeamConfiguration':
        """Load configuration from file."""
        file_path = Path(file_path)
        
        if not file_path.exists():
            raise FileNotFoundError(f"Configuration file not found: {file_path}")
        
        with open(file_path, 'r') as f:
            content = f.read()
        
        if file_path.suffix.lower() in ['.yml', '.yaml']:
            return cls.from_yaml(content)
        elif file_path.suffix.lower() == '.json':
            return cls.from_json(content)
        else:
            raise ValueError(f"Unsupported file format: {file_path.suffix}")
    
    def save_to_file(self, file_path: Union[str, Path]) -> None:
        """Save configuration to file."""
        file_path = Path(file_path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        if file_path.suffix.lower() in ['.yml', '.yaml']:
            content = self.to_yaml()
        elif file_path.suffix.lower() == '.json':
            content = self.to_json()
        else:
            raise ValueError(f"Unsupported file format: {file_path.suffix}")
        
        with open(file_path, 'w') as f:
            f.write(content)


class ConfigurationValidator:
    """Validates team configuration for completeness and correctness."""
    
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
    
    def validate(self, config: TeamConfiguration) -> bool:
        """Validate configuration and return True if valid."""
        self.errors.clear()
        self.warnings.clear()
        
        self._validate_basic_structure(config)
        self._validate_ticketing_systems(config)
        self._validate_templates(config)
        self._validate_overrides(config)
        
        return len(self.errors) == 0
    
    def _validate_basic_structure(self, config: TeamConfiguration) -> None:
        """Validate basic configuration structure."""
        if not config.team_name.strip():
            self.warnings.append("Team name is empty - consider setting for better identification")
        
        if not config.automatic_issue_creation.default_ticketing_system:
            self.errors.append("Default ticketing system must be specified")
        
        if config.automatic_issue_creation.max_issues_per_spec <= 0:
            self.errors.append("Max issues per spec must be positive")
        
        if config.automatic_issue_creation.processing_timeout <= 0:
            self.errors.append("Processing timeout must be positive")
    
    def _validate_ticketing_systems(self, config: TeamConfiguration) -> None:
        """Validate ticketing system configurations."""
        if not config.ticketing_systems:
            self.errors.append("At least one ticketing system must be configured")
            return
        
        default_system = config.automatic_issue_creation.default_ticketing_system
        if default_system not in config.ticketing_systems:
            self.errors.append(f"Default ticketing system '{default_system}' not found in configured systems")
        
        for name, system in config.ticketing_systems.items():
            self._validate_ticketing_system(name, system)
    
    def _validate_ticketing_system(self, name: str, system: TicketingSystemConfig) -> None:
        """Validate individual ticketing system configuration."""
        if system.system_type == "linear":
            if not system.team_id:
                self.errors.append(f"Linear system '{name}' missing required team_id")
        
        elif system.system_type == "github":
            if not system.repository_owner or not system.repository_name:
                self.errors.append(f"GitHub system '{name}' missing required repository_owner and repository_name")
        
        elif system.system_type == "jira":
            if not system.project_key:
                self.errors.append(f"Jira system '{name}' missing required project_key")
        
        else:
            self.warnings.append(f"Unknown ticketing system type '{system.system_type}' for system '{name}'")
    
    def _validate_templates(self, config: TeamConfiguration) -> None:
        """Validate issue templates."""
        if not config.templates:
            self.warnings.append("No issue templates configured - will use system defaults")
            return
        
        # Check for common template types
        recommended_types = [t.value for t in IssueTemplateType]
        missing_types = [t for t in recommended_types if t not in config.templates]
        
        if missing_types:
            self.warnings.append(f"Missing recommended templates: {', '.join(missing_types)}")
        
        # Validate individual templates
        for name, template in config.templates.items():
            if template.labels and not all(isinstance(label, str) for label in template.labels):
                self.errors.append(f"Template '{name}' has invalid labels - must be strings")
    
    def _validate_overrides(self, config: TeamConfiguration) -> None:
        """Validate project override configurations."""
        for project_name, overrides in config.project_overrides.items():
            if not isinstance(overrides, dict):
                self.errors.append(f"Project override '{project_name}' must be a dictionary")
            
            # Additional validation for overrides could be added here
    
    def get_validation_report(self) -> str:
        """Get a formatted validation report."""
        report = []
        
        if self.errors:
            report.append("❌ CONFIGURATION ERRORS:")
            for error in self.errors:
                report.append(f"  - {error}")
        
        if self.warnings:
            report.append("⚠️ CONFIGURATION WARNINGS:")
            for warning in self.warnings:
                report.append(f"  - {warning}")
        
        if not self.errors and not self.warnings:
            report.append("✅ Configuration is valid")
        
        return "\n".join(report)


# Example usage and factory functions
def create_linear_team_config(team_id: str, team_name: str = "") -> TeamConfiguration:
    """Create a Linear-based team configuration."""
    return TeamConfiguration(
        team_name=team_name,
        automatic_issue_creation=AutomaticIssueCreationConfig(
            default_ticketing_system="linear"
        ),
        ticketing_systems={
            "linear": TicketingSystemConfig(
                system_type="linear",
                team_id=team_id,
                default_labels=["auto-generated"]
            )
        }
    )


def create_github_team_config(owner: str, repo: str, team_name: str = "") -> TeamConfiguration:
    """Create a GitHub-based team configuration."""
    return TeamConfiguration(
        team_name=team_name,
        automatic_issue_creation=AutomaticIssueCreationConfig(
            default_ticketing_system="github"
        ),
        ticketing_systems={
            "github": TicketingSystemConfig(
                system_type="github",
                repository_owner=owner,
                repository_name=repo,
                default_labels=["auto-generated"]
            )
        }
    )


def create_default_config() -> TeamConfiguration:
    """Create a default configuration with common settings."""
    return TeamConfiguration(
        team_name="Default Team",
        automatic_issue_creation=AutomaticIssueCreationConfig(),
        ticketing_systems={
            "linear": TicketingSystemConfig(
                system_type="linear",
                team_id="TEAM-123",
                enabled=False  # Disabled by default, needs configuration
            )
        }
    )