# bounswe2026group4
CMPE354 Group 4 repository

## Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r ../requirements/development.txt
cp ../.env.example .env  # fill in your values
```

## Database Setup

Create the development and test databases in MySQL:

```sql
CREATE DATABASE historystorymap CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE historystorymap_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Run migrations (from `backend/`):

```bash
# Development database
python manage.py migrate

# Test database
python manage.py migrate --settings=config.settings.test
```

When a new app is added, generate its migration first:

```bash
python manage.py makemigrations <app_name>
python manage.py migrate
```

## Running Tests

All commands must be run from the `backend/` directory with the virtual environment activated.

```bash
# All tests
python -m pytest -v

# User model tests
python -m pytest apps/users/tests/test_models.py -v

# Validator tests
python -m pytest common/tests/test_validators.py -v

# Exception handler tests
python -m pytest common/tests/test_exceptions.py -v
```
