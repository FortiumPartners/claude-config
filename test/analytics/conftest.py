"""
Test configuration and shared fixtures for analytics tests.
"""
import pytest
import tempfile
import os
from pathlib import Path

import sys
sys.path.append(str(Path(__file__).parent.parent.parent / 'src'))

from analytics.database import DatabaseManager


@pytest.fixture(scope="session")
def temp_directory():
    """Create temporary directory for test files."""
    temp_dir = tempfile.mkdtemp(prefix="analytics_test_")
    yield temp_dir
    
    # Cleanup
    import shutil
    try:
        shutil.rmtree(temp_dir)
    except OSError:
        pass


@pytest.fixture
def clean_temp_db():
    """Create clean temporary database for each test."""
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
    temp_file.close()
    
    db_manager = DatabaseManager(temp_file.name)
    success = db_manager.initialize_database()
    
    if not success:
        pytest.fail("Failed to initialize test database")
        
    yield db_manager
    
    # Cleanup
    try:
        os.unlink(temp_file.name)
    except OSError:
        pass


@pytest.fixture
def sample_users():
    """Sample user IDs for testing."""
    return ["user1", "user2", "user3", "test_user", "admin_user"]


@pytest.fixture
def sample_sessions():
    """Sample session IDs for testing."""
    return ["session1", "session2", "test_session", "admin_session"]