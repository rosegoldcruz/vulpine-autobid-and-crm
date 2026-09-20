FROM python:3.12-slim

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

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (Chromium only for scanning)
RUN playwright install chromium && playwright install-deps chromium

COPY . .

EXPOSE 8000

CMD ["uvicorn", "shared.server:app", "--host", "0.0.0.0", "--port", "8000"]
