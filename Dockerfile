# Use the official bookworm image to guarantee SQLite 3.40 (Fixes ChromaDB crashes)
FROM python:3.11-slim-bookworm

# Allow statements and log messages to immediately appear in the Knative logs
ENV PYTHONUNBUFFERED True

# Copy local code to the container image.
ENV APP_HOME /app
WORKDIR $APP_HOME
COPY . ./

# Install production dependencies.
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Bind directly using Uvicorn's shell command to seamlessly hijack Cloud Run's port
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}

