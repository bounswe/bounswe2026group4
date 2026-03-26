"""
Compatibility package for test labels that start with ``backend.``.

The Docker image copies the Django project contents directly into ``/app``,
so the real Python packages are ``apps``, ``config``, and ``common``.
This shim keeps imports like ``backend.apps.stories...`` working.
"""

from importlib import import_module
import sys


for package_name in ('apps', 'config', 'common'):
    package = import_module(package_name)
    sys.modules[f'{__name__}.{package_name}'] = package
    globals()[package_name] = package
