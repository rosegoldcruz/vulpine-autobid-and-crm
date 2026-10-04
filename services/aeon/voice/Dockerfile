FROM python:3.11-slim

WORKDIR /srv

# Install dependencies first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application
COPY app/ ./app/
COPY static/ ./static/

ENV PORT=8080 \
    DATA_DIR=/data \
    PYTHONUNBUFFERED=1

VOLUME ["/data"]
EXPOSE 8080

# ${PORT} is expanded by sh at container start
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
