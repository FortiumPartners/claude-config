#!/usr/bin/env python3
"""
Command-line interface for automatic issue creation configuration.

Provides utilities for setting up and managing configurations.
"""

import argparse
import sys
from pathlib import Path
from typing import Optional

from configuration_manager import ConfigurationManager, ProjectConfigurationManager
from configuration_schema import TeamConfiguration, ConfigurationValidator
from default_templates import DefaultTemplateLibrary


def setup_config_command(args) -> None:
    """Set up configuration for a project."""
    manager = ProjectConfigurationManager(args.project_root or Path.cwd())
    
    try:
        # Determine system-specific parameters
        system_kwargs = {}
        if args.system_type == "linear":
            if args.team_id:
                system_kwargs["team_id"] = args.team_id
            else:
                print("❌ Error: Linear configuration requires --team-id parameter")
                return
        
        elif args.system_type == "github":
            if args.owner and args.repo:
                system_kwargs["owner"] = args.owner
                system_kwargs["repo"] = args.repo
            else:
                print("❌ Error: GitHub configuration requires --owner and --repo parameters")
                return
        
        # Set up configuration
        config_path = manager.setup_project_configuration(
            system_type=args.system_type,
            force_overwrite=args.force,
            **system_kwargs
        )
        
        print(f"✅ Configuration created successfully at: {config_path}")
        print(f"📝 Edit the file to customize templates and settings for your team")
        
    except FileExistsError as e:
        print(f"❌ Error: {e}")
        print("💡 Use --force to overwrite existing configuration")
    
    except Exception as e:
        print(f"❌ Error setting up configuration: {e}")


def validate_config_command(args) -> None:
    """Validate configuration."""
    manager = ConfigurationManager(args.project_root)
    
    try:
        config = manager.load_configuration()
        validation = manager.validate_configuration(config)
        
        print("🔍 Configuration Validation Report")
        print("=" * 50)
        
        if validation["valid"]:
            print("✅ Configuration is valid!")
        else:
            print("❌ Configuration has errors:")
            for error in validation["errors"]:
                print(f"  - {error}")
        
        if validation["warnings"]:
            print("\n⚠️ Warnings:")
            for warning in validation["warnings"]:
                print(f"  - {warning}")
        
        # Show active configuration paths
        active_paths = manager.get_active_configuration_paths()
        if active_paths:
            print(f"\n📁 Active configuration files:")
            for path in active_paths:
                print(f"  - {path}")
        else:
            print(f"\n📁 No configuration files found - using defaults")
        
    except Exception as e:
        print(f"❌ Error validating configuration: {e}")


def show_status_command(args) -> None:
    """Show configuration status."""
    if args.project_root:
        manager = ProjectConfigurationManager(args.project_root)
        status = manager.get_project_configuration_status()
        
        print("📊 Project Configuration Status")
        print("=" * 40)
        print(f"Project: {Path(args.project_root).name}")
        print(f"Has project config: {'✅' if status['has_project_config'] else '❌'}")
        
        if status.get("config_file"):
            print(f"Config file: {status['config_file']}")
        
        if "valid" in status:
            print(f"Valid: {'✅' if status['valid'] else '❌'}")
            
            if status.get("errors"):
                print("Errors:")
                for error in status["errors"]:
                    print(f"  - {error}")
        
    else:
        manager = ConfigurationManager()
        active_paths = manager.get_active_configuration_paths()
        
        print("📊 Global Configuration Status")
        print("=" * 40)
        
        if active_paths:
            print("Active configurations:")
            for path in active_paths:
                print(f"  - {path}")
        else:
            print("No configuration files found")


def show_templates_command(args) -> None:
    """Show available templates."""
    print(f"📋 Available Templates for {args.system_type.upper()}")
    print("=" * 50)
    
    templates = DefaultTemplateLibrary.get_templates_for_system(args.system_type)
    
    for template_type, template in templates.items():
        print(f"\n🏷️ {template_type.upper()}")
        print(f"  Title prefix: {template.title_prefix}")
        print(f"  Labels: {', '.join(template.labels)}")
        
        if template.priority_mapping:
            print(f"  Priority mapping: {template.priority_mapping}")
        
        if template.custom_fields:
            print(f"  Custom fields: {', '.join(template.custom_fields.keys())}")


def export_config_command(args) -> None:
    """Export current configuration."""
    manager = ConfigurationManager(args.project_root)
    
    try:
        config = manager.load_configuration()
        
        if args.format == "yaml":
            output = config.to_yaml()
        else:
            output = config.to_json()
        
        if args.output:
            output_path = Path(args.output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_path, 'w') as f:
                f.write(output)
            
            print(f"✅ Configuration exported to: {output_path}")
        else:
            print(output)
    
    except Exception as e:
        print(f"❌ Error exporting configuration: {e}")


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Automatic Issue Creation Configuration Manager",
        prog="config-manager"
    )
    
    parser.add_argument(
        "--project-root",
        type=str,
        help="Project root directory (default: current directory)"
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Setup command
    setup_parser = subparsers.add_parser(
        "setup",
        help="Set up configuration for a project"
    )
    setup_parser.add_argument(
        "system_type",
        choices=["linear", "github", "jira"],
        help="Ticketing system type"
    )
    setup_parser.add_argument(
        "--team-id",
        help="Team ID (required for Linear)"
    )
    setup_parser.add_argument(
        "--owner",
        help="Repository owner (required for GitHub)"
    )
    setup_parser.add_argument(
        "--repo",
        help="Repository name (required for GitHub)"
    )
    setup_parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing configuration"
    )
    setup_parser.set_defaults(func=setup_config_command)
    
    # Validate command
    validate_parser = subparsers.add_parser(
        "validate",
        help="Validate configuration"
    )
    validate_parser.set_defaults(func=validate_config_command)
    
    # Status command
    status_parser = subparsers.add_parser(
        "status",
        help="Show configuration status"
    )
    status_parser.set_defaults(func=show_status_command)
    
    # Templates command
    templates_parser = subparsers.add_parser(
        "templates",
        help="Show available templates"
    )
    templates_parser.add_argument(
        "--system-type",
        choices=["linear", "github", "jira", "standard"],
        default="standard",
        help="System type for templates"
    )
    templates_parser.set_defaults(func=show_templates_command)
    
    # Export command
    export_parser = subparsers.add_parser(
        "export",
        help="Export current configuration"
    )
    export_parser.add_argument(
        "--format",
        choices=["yaml", "json"],
        default="yaml",
        help="Export format"
    )
    export_parser.add_argument(
        "--output",
        help="Output file (default: stdout)"
    )
    export_parser.set_defaults(func=export_config_command)
    
    # Parse and execute
    args = parser.parse_args()
    
    if not hasattr(args, 'func'):
        parser.print_help()
        sys.exit(1)
    
    try:
        args.func(args)
    except KeyboardInterrupt:
        print("\n❌ Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()