.PHONY: help check-tools check-node check-dev-slot setup dev worktree dev-on-slot backend frontend dev-backend dev-frontend e2e e2e-desktop e2e-mobile e2e-install-browser

# Defaults keep standalone backend/frontend targets aligned. `make worktree`
# automatically locks and allocates a free slot for the lifetime of both services.
DEV_SLOT ?= $(shell git rev-parse --show-toplevel 2>/dev/null | cksum | awk '{print $$1 % 1000}')
BACKEND_PORT ?= $(shell expr 8765 + $(DEV_SLOT) \* 2)
ADMIN_PORT ?= $(shell expr 8766 + $(DEV_SLOT) \* 2)
FRONTEND_PORT ?= $(shell expr 3000 + $(DEV_SLOT))

help:
	@printf '%s\n' \
	  'make setup    Install backend and frontend dependencies (Python 3.10, Node.js 20)' \
	  'make worktree Start both services with an automatically allocated free slot' \
	  'make dev      Alias for make worktree' \
	  'make worktree DEV_SLOT=12  Use a specific free slot' \
	  'make e2e     Run CI desktop and mobile browser acceptance suites' \
	  'make e2e-install-browser  Install Playwright Chromium locally' \
	  'make backend  Start only the backend' \
	  'make frontend Start only the frontend'

check-tools:
	@command -v uv >/dev/null || { echo 'uv is required: https://docs.astral.sh/uv/'; exit 1; }
	@command -v python3 >/dev/null || { echo 'python3 is required to allocate worktree ports.'; exit 1; }
	@command -v node >/dev/null || { echo 'Node.js 20 is required: https://nodejs.org/'; exit 1; }
	@command -v npm >/dev/null || { echo 'npm is required (install it with Node.js 20).'; exit 1; }

check-node: check-tools
	@node -e 'const major = Number(process.versions.node.split(".")[0]); if (major !== 20) { console.error(`This project requires Node.js 20; found $${process.version}.`); process.exit(1); }'

check-dev-slot:
	@case '$(DEV_SLOT)' in ''|*[!0-9]*) echo 'DEV_SLOT must be an integer from 0 to 999.'; exit 1;; esac
	@test '$(DEV_SLOT)' -le 999 || { echo 'DEV_SLOT must be between 0 and 999.'; exit 1; }

setup: check-node
	cd backend && uv sync --frozen --python 3.10
	cd frontend && npm ci
	@echo 'Dependencies installed. Run make worktree to start the local game.'

e2e: setup
	cd frontend && npm run test:e2e
	cd frontend && npm run test:e2e:mobile
	@echo 'Acceptance artifacts: frontend/test-results/{full-game,scenarios,voice-chat,avatar-profile,mobile-game}/'
	@echo 'Review multiview.html in full-game, scenarios, and mobile-game; inspect reports/screenshots in voice-chat and avatar-profile.'

e2e-desktop: setup
	cd frontend && npm run test:e2e
	@echo 'Desktop artifacts: frontend/test-results/{full-game,scenarios,voice-chat,avatar-profile}/'

e2e-mobile: setup
	cd frontend && npm run test:e2e:mobile
	@echo 'Mobile artifacts: frontend/test-results/mobile-game/'

e2e-install-browser: setup
	cd frontend && npx playwright install chromium

dev worktree: check-node check-tools
	DEV_SLOT_OVERRIDE='$(if $(filter command line environment,$(origin DEV_SLOT)),$(DEV_SLOT),)' python3 scripts/dev-worktree.py

dev-on-slot: check-dev-slot
	@echo 'Frontend: http://localhost:$(FRONTEND_PORT)  Backend: ws://localhost:$(BACKEND_PORT)  Admin API: http://localhost:$(ADMIN_PORT)'
	BACKEND_PORT=$(BACKEND_PORT) ADMIN_PORT=$(ADMIN_PORT) FRONTEND_PORT=$(FRONTEND_PORT) $(MAKE) --jobs=2 dev-backend dev-frontend

backend: check-tools check-dev-slot
	cd backend && PORT=$(BACKEND_PORT) ADMIN_HTTP_PORT=$(ADMIN_PORT) uv run --frozen --python 3.10 python main.py

frontend: check-node check-dev-slot
	cd frontend && FRONTEND_PORT=$(FRONTEND_PORT) BACKEND_PORT=$(BACKEND_PORT) ADMIN_PORT=$(ADMIN_PORT) npm run dev

dev-backend:
	cd backend && PORT=$(BACKEND_PORT) ADMIN_HTTP_PORT=$(ADMIN_PORT) uv run --frozen --python 3.10 python main.py

dev-frontend:
	cd frontend && FRONTEND_PORT=$(FRONTEND_PORT) BACKEND_PORT=$(BACKEND_PORT) ADMIN_PORT=$(ADMIN_PORT) npm run dev
