#!/usr/bin/env python3
"""
Configuration management system for automatic issue creation.

Handles loading, merging, and validation of team and project configurations.
"""

import os
import logging
from typing import Dict, List, Optional, Any, Union
from pathlib import Path
from datetime import datetime

# Try importing with graceful fallback
try:
    from configuration_schema import (
        TeamConfiguration, ConfigurationValidator,
        create_default_config, create_linear_team_config, create_github_team_config
    )
except ImportError as e:
    if "yaml" in str(e).lower():
        # Create minimal fallback for missing YAML
        class TeamConfiguration:
            def __init__(self, **kwargs):
                for k, v in kwargs.items():
                    setattr(self, k, v)
        ConfigurationValidator = None
        create_default_config = lambda: TeamConfiguration(team_name="Default")
        create_linear_team_config = lambda *args, **kwargs: TeamConfiguration(team_name="Linear")
        create_github_team_config = lambda *args, **kwargs: TeamConfiguration(team_name="GitHub")
    else:
        raise


class ConfigurationManager:
    """
    Manages team and project-specific configurations with hierarchical overrides.
    
    Configuration precedence (highest to lowest):
    1. Explicit overrides passed to methods
    2. Project-specific configuration (.agent-os/config/)
    3. User home configuration (~/.agent-os/config/)
    4. Global Claude configuration (~/.claude/config/)
    5. Built-in defaults
    """
    
    def __init__(self, project_root: Optional[Union[str, Path]] = None):
        """Initialize configuration manager."""
        self.project_root = Path(project_root) if project_root else Path.cwd()
        self.logger = logging.getLogger(__name__)
        self._config_cache: Dict[str, TeamConfiguration] = {}
        
        # Configuration search paths in order of precedence
        self.search_paths = [
            # Project-specific (highest precedence)
            self.project_root / ".agent-os" / "config",
            
            # User-specific 
            Path.home() / ".agent-os" / "config",
            
            # Claude global configuration
            Path.home() / ".claude" / "config",
        ]
    
    def load_configuration(
        self, 
        config_name: str = "issue-creation",
        overrides: Optional[Dict[str, Any]] = None
    ) -> TeamConfiguration:
        """
        Load configuration with hierarchical precedence.
        
        Args:
            config_name: Name of configuration file (without extension)
            overrides: Explicit overrides to apply
            
        Returns:
            Merged configuration
        """
        cache_key = f"{config_name}_{hash(str(overrides)) if overrides else 'none'}"
        
        if cache_key in self._config_cache:
            return self._config_cache[cache_key]
        
        # Start with default configuration
        merged_config = create_default_config()
        config_loaded = False
        
        # Load and merge configurations in precedence order (reverse)
        for config_path in reversed(self.search_paths):
            config_file = self._find_config_file(config_path, config_name)
            if config_file:
                try:
                    file_config = TeamConfiguration.from_file(config_file)
                    merged_config = self._merge_configurations(merged_config, file_config)
                    config_loaded = True
                    self.logger.info(f"Loaded configuration from {config_file}")
                except Exception as e:
                    self.logger.warning(f"Failed to load config from {config_file}: {e}")
        
        # Apply explicit overrides
        if overrides:
            override_config = self._create_config_from_overrides(overrides)
            merged_config = self._merge_configurations(merged_config, override_config)
        
        # Update metadata
        merged_config.last_updated = datetime.now().isoformat()
        
        # Validate final configuration
        validator = ConfigurationValidator()
        if not validator.validate(merged_config):
            self.logger.warning(f"Configuration validation failed:\n{validator.get_validation_report()}")
        
        # Cache result
        self._config_cache[cache_key] = merged_config
        
        return merged_config
    
    def save_configuration(
        self,
        config: TeamConfiguration,
        config_name: str = "issue-creation",
        scope: str = "project",
        format_type: str = "yaml"
    ) -> Path:
        """
        Save configuration to appropriate location.
        
        Args:
            config: Configuration to save
            config_name: Name for configuration file
            scope: Where to save ("project", "user", "global")
            format_type: File format ("yaml" or "json")
            
        Returns:
            Path where configuration was saved
        """
        # Determine save location
        if scope == "project":
            save_path = self.project_root / ".agent-os" / "config"
        elif scope == "user":
            save_path = Path.home() / ".agent-os" / "config"
        elif scope == "global":
            save_path = Path.home() / ".claude" / "config"
        else:
            raise ValueError(f"Invalid scope: {scope}. Must be 'project', 'user', or 'global'")
        
        # Create directory if it doesn't exist
        save_path.mkdir(parents=True, exist_ok=True)
        
        # Create file path
        extension = "yml" if format_type == "yaml" else "json"
        config_file = save_path / f"{config_name}.{extension}"
        
        # Save configuration
        config.last_updated = datetime.now().isoformat()
        try:
            config.save_to_file(config_file)
        except ImportError as e:
            # Fall back to JSON if YAML not available
            if "PyYAML" in str(e) and format_type == "yaml":
                self.logger.warning("PyYAML not available, saving as JSON instead")
                config_file = config_file.with_suffix('.json')
                config.save_to_file(config_file)
            else:
                raise
        
        self.logger.info(f"Saved configuration to {config_file}")
        
        # Clear cache to force reload
        self._config_cache.clear()
        
        return config_file
    
    def create_sample_configuration(
        self,
        system_type: str,
        team_name: str = "",
        **kwargs
    ) -> TeamConfiguration:
        """
        Create sample configuration for a ticketing system.
        
        Args:
            system_type: Type of ticketing system ("linear", "github", "jira")
            team_name: Name for the team
            **kwargs: System-specific parameters
            
        Returns:
            Sample configuration
        """
        if system_type == "linear":
            team_id = kwargs.get("team_id", "TEAM-123")
            return create_linear_team_config(team_id, team_name)
        
        elif system_type == "github":
            owner = kwargs.get("owner", "your-org")
            repo = kwargs.get("repo", "your-repo")
            return create_github_team_config(owner, repo, team_name)
        
        else:
            # Create generic configuration
            config = create_default_config()
            config.team_name = team_name
            config.automatic_issue_creation.default_ticketing_system = system_type
            
            return config
    
    def validate_configuration(self, config: TeamConfiguration) -> Dict[str, Any]:
        """
        Validate configuration and return detailed report.
        
        Args:
            config: Configuration to validate
            
        Returns:
            Validation report
        """
        validator = ConfigurationValidator()
        is_valid = validator.validate(config)
        
        return {
            "valid": is_valid,
            "errors": validator.errors,
            "warnings": validator.warnings,
            "report": validator.get_validation_report()
        }
    
    def get_active_configuration_paths(self) -> List[str]:
        """Get list of configuration files that would be loaded."""
        active_paths = []
        
        for config_path in self.search_paths:
            config_file = self._find_config_file(config_path, "issue-creation")
            if config_file:
                active_paths.append(str(config_file))
        
        return active_paths
    
    def clear_cache(self) -> None:
        """Clear configuration cache."""
        self._config_cache.clear()
        self.logger.debug("Configuration cache cleared")
    
    def _find_config_file(self, base_path: Path, config_name: str) -> Optional[Path]:
        """Find configuration file with supported extensions."""
        for extension in ['.yml', '.yaml', '.json']:
            config_file = base_path / f"{config_name}{extension}"
            if config_file.exists():
                return config_file
        return None
    
    def _merge_configurations(
        self, 
        base_config: TeamConfiguration, 
        override_config: TeamConfiguration
    ) -> TeamConfiguration:
        """Merge two configurations with override precedence."""
        # Convert to dictionaries for easier merging
        base_dict = base_config.to_dict()
        override_dict = override_config.to_dict()
        
        # Merge dictionaries recursively
        merged_dict = self._deep_merge_dicts(base_dict, override_dict)
        
        # Convert back to TeamConfiguration
        return TeamConfiguration.from_dict(merged_dict)
    
    def _deep_merge_dicts(self, base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively merge dictionaries."""
        result = base.copy()
        
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge_dicts(result[key], value)
            else:
                result[key] = value
        
        return result
    
    def _create_config_from_overrides(self, overrides: Dict[str, Any]) -> TeamConfiguration:
        """Create partial configuration from override dictionary."""
        # Start with minimal config and apply overrides
        base_config = create_default_config()
        base_dict = base_config.to_dict()
        
        # Apply overrides
        merged_dict = self._deep_merge_dicts(base_dict, overrides)
        
        return TeamConfiguration.from_dict(merged_dict)


class ProjectConfigurationManager(ConfigurationManager):
    """Specialized configuration manager for project-specific needs."""
    
    def __init__(self, project_root: Union[str, Path]):
        """Initialize with specific project root."""
        super().__init__(project_root)
        self.project_root = Path(project_root)
    
    def setup_project_configuration(
        self,
        system_type: str,
        force_overwrite: bool = False,
        **system_kwargs
    ) -> Path:
        """
        Set up configuration for the current project.
        
        Args:
            system_type: Ticketing system type
            force_overwrite: Whether to overwrite existing config
            **system_kwargs: System-specific configuration
            
        Returns:
            Path to created configuration file
        """
        config_dir = self.project_root / ".agent-os" / "config"
        config_file = config_dir / "issue-creation.yml"
        
        if config_file.exists() and not force_overwrite:
            raise FileExistsError(f"Configuration already exists: {config_file}")
        
        # Create sample configuration
        project_name = self.project_root.name
        config = self.create_sample_configuration(
            system_type=system_type,
            team_name=f"{project_name} Team",
            **system_kwargs
        )
        
        # Save to project
        return self.save_configuration(config, scope="project")
    
    def get_project_configuration_status(self) -> Dict[str, Any]:
        """Get status of project configuration."""
        config_file = self.project_root / ".agent-os" / "config" / "issue-creation.yml"
        alt_config_file = self.project_root / ".agent-os" / "config" / "issue-creation.json"
        
        status = {
            "has_project_config": config_file.exists() or alt_config_file.exists(),
            "config_file": str(config_file) if config_file.exists() else str(alt_config_file) if alt_config_file.exists() else None,
            "active_paths": self.get_active_configuration_paths()
        }
        
        if status["has_project_config"]:
            try:
                config = self.load_configuration()
                validation = self.validate_configuration(config)
                status["valid"] = validation["valid"]
                status["errors"] = validation["errors"]
                status["warnings"] = validation["warnings"]
            except Exception as e:
                status["valid"] = False
                status["errors"] = [str(e)]
                status["warnings"] = []
        
        return status


# Utility functions for common operations
def get_configuration_manager(project_root: Optional[str] = None) -> ConfigurationManager:
    """Get configuration manager instance."""
    return ConfigurationManager(project_root)


def load_project_configuration(
    project_root: Optional[str] = None,
    overrides: Optional[Dict[str, Any]] = None
) -> TeamConfiguration:
    """Load configuration for a project."""
    manager = get_configuration_manager(project_root)
    return manager.load_configuration(overrides=overrides)


def setup_team_configuration(
    system_type: str,
    project_root: Optional[str] = None,
    scope: str = "project",
    **system_kwargs
) -> Path:
    """Set up team configuration for automatic issue creation."""
    manager = ProjectConfigurationManager(project_root or Path.cwd())
    config = manager.create_sample_configuration(system_type, **system_kwargs)
    return manager.save_configuration(config, scope=scope)