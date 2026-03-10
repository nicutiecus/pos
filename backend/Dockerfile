# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables to prevent Python from writing pyc files
# and to ensure output is sent directly to the terminal
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set work directory inside the container
WORKDIR /app

# Install system dependencies (needed for Postgres and generic Linux tools)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt /app/
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy the rest of the project code
COPY . /app/

# 1. Provide dummy variables so settings.py doesn't crash during the build
ARG SECRET_KEY="dummy-key-for-build"
ARG DEBUG="True"
# (If settings.py strictly requires a DATABASE_URL to even load)
# ARG DATABASE_URL="sqlite:////tmp/db.sqlite3"

# 2. Collect the static files into STATIC_ROOT
RUN python manage.py collectstatic --noinput