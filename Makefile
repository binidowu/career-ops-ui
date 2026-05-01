NVM_DIR  := $(HOME)/.nvm
NODE_VER := 22

# Source nvm and activate the correct Node version before running any command.
# nvm is a shell function, not a binary, so it must be sourced inside bash.
RUN := bash -c 'source "$(NVM_DIR)/nvm.sh" && nvm use $(NODE_VER) --silent &&

.PHONY: dev build start install lint typecheck kill

kill:
	@lsof -ti :3000 | xargs kill -9 2>/dev/null || true
	@lsof -ti :3001 | xargs kill -9 2>/dev/null || true
	@echo "dev server stopped"

dev: kill
	$(RUN) npm run dev'

build:
	$(RUN) npm run build'

start:
	$(RUN) npm run start'

install:
	$(RUN) npm install'

lint:
	$(RUN) npm run lint'

typecheck:
	$(RUN) npx tsc --noEmit --project tsconfig.check.json'
