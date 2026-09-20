.PHONY: up down build logs shell db-reset db-migrate scan score import

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f api

shell:
	docker compose exec api bash

db-shell:
	docker compose exec postgres psql -U vulpine -d vulpine

db-reset:
	docker compose down -v postgres
	docker compose up -d postgres
	@sleep 5
	docker compose exec -T postgres psql -U vulpine -d vulpine -f /docker-entrypoint-initdb.d/01-init.sql

db-migrate:
	docker compose exec api alembic upgrade head

# Phase 1 Commands
import:
	docker compose exec api python -m services.discovery.importer

score:
	docker compose exec api python -m services.scoring.engine

scan-planhub:
	docker compose exec api python -m services.planhub_scanner.scanner

scan-bc:
	docker compose exec api python -m services.bc_scanner.scanner

# Dev
dev:
	docker compose up -d postgres redis
	uvicorn shared.server:app --reload --host 0.0.0.0 --port 8000

test:
	docker compose exec api pytest -v

clean:
	docker compose down -v
	rm -rf uploads/*
