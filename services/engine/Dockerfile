FROM python:3.12.13-slim-trixie@sha256:229a2c5bfa27522db7815ea81f9bed70af17ccb9de9fc7ad142b1877b5830d36

WORKDIR /app

# System deps for PDF generation and Playwright (Phase 1 essentials)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    libmagic1 \
    curl \
    && rm -rf /var/lib/apt/lists/*
    # tesseract-ocr added in Phase 3 for plan OCR

COPY requirements.txt requirements.lock ./
RUN pip install --no-cache-dir -r requirements.lock

# Install shared read-only browser binaries for the unprivileged runtime.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
RUN playwright install chromium && playwright install-deps chromium

COPY . .

EXPOSE 8000

CMD ["uvicorn", "shared.server:app", "--host", "0.0.0.0", "--port", "8000"]
