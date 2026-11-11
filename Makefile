# Atalhos do projeto. Rode `make` para ver a lista.
.DEFAULT_GOAL := help
.PHONY: help api demo up down logs deps test test-offline seed migrate migration openapi prod-up prod-logs prod-seed prod-movielens backup

PROD := docker compose -f docker-compose.prod.yml --env-file .env.production
PYTHON := ../.venv/bin/python

help: ## Mostra os comandos disponíveis
	@awk -F ':.*## ' '/^[a-z-]+:.*## / { printf "  %-16s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# ---------- Desenvolvimento
api: ## Sobe só a API, com SQLite
	./dev.sh

demo: ## Sobe a API e a interface, sem Docker
	./demo.sh

up: ## Sobe tudo no Docker, com PostgreSQL
	docker compose up --build -d

down: ## Para o Docker, mantendo os dados
	docker compose down

logs: ## Acompanha os logs do Docker
	docker compose logs -f

# ---------- Testes e contrato
.venv/bin/python:
	python3 -m venv .venv

deps: .venv/bin/python
	.venv/bin/pip install -q -r backend/requirements-dev.txt

test: deps ## Roda todos os testes
	cd backend && $(PYTHON) -m pytest -q

test-offline: deps ## Roda os testes que não usam o TMDB real
	cd backend && $(PYTHON) -m pytest -q -m "not integration"

seed: deps ## Recria o banco SQLite local
	cd backend && $(PYTHON) -m scripts.seed

migrate: deps ## Aplica as migrações pendentes no banco local
	cd backend && $(PYTHON) -m alembic upgrade head

migration: deps ## Cria uma migração a partir dos modelos (exige MSG="o que mudou")
	@test -n "$(MSG)" || { echo 'Descreva a mudança: make migration MSG="álbuns como terceira mídia"'; exit 1; }
	cd backend && $(PYTHON) -m alembic upgrade head && $(PYTHON) -m alembic revision --autogenerate -m "$(MSG)"

openapi: deps ## Regenera docs/tecnico/openapi.json
	cd backend && TASTORY_AUTO_SEED=false $(PYTHON) -c "import json; from app.main import app; json.dump(app.openapi(), open('../docs/tecnico/openapi.json','w'), ensure_ascii=False, indent=2)"

# ---------- Produção (veja docs/tecnico/DEPLOY.md)
prod-up: ## Sobe ou atualiza o sistema publicado
	$(PROD) up --build -d

prod-logs: ## Acompanha os logs do sistema publicado
	$(PROD) logs -f

prod-seed: ## Apaga e recarrega o banco publicado (exige CONFIRMAR=sim)
	@test "$(CONFIRMAR)" = "sim" || { echo "Este comando apaga todas as tabelas. Para rodar: make prod-seed CONFIRMAR=sim"; exit 1; }
	$(PROD) exec api python -m scripts.seed --no-sim --no-synthetic --tmdb

prod-movielens: ## Carrega o MovieLens (exige DATA=/caminho/ml-32m)
	@test -n "$(DATA)" || { echo "Informe a pasta: make prod-movielens DATA=/caminho/ml-32m"; exit 1; }
	$(PROD) run --rm -v "$(DATA):/data:ro" api python -m scripts.import_movielens /data

# Se a exportação falhar, o make para aqui, e a cópia do dia continua intacta
backup: ## Copia o banco publicado para backup-AAAA-MM-DD.sql
	$(PROD) exec -T db pg_dump -U tastory tastory > backup-parcial.sql
	mv backup-parcial.sql backup-$$(date +%F).sql
