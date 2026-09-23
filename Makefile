# The Open Inequality Atlas, end to end.
#
#   make            fetch the sources, check them, rebuild every data file
#   make check      confirm the sources are the ones this repository was built from
#   make serve      serve the page at http://localhost:8744
#   make test       drive the page in a real browser and check what is on screen
#   make clean      remove the fetched sources, keeping the built data files
#
# The page is one HTML file that loads data/*.json and nothing else. Everything below
# exists to produce those JSON files from upstream sources that are not in the tree.

PY ?= python3
PORT ?= 8744

BUILDS := build_manifest.py build_cz.py build_us.py build_us_deep.py build_social.py \
          build_income_shares.py build_house_prices.py build_composition.py \
          build_hfcs.py build_scf.py

.PHONY: all data check serve test clean deps release-archive release-curl help

all: data

## fetch the upstream sources, verify them, and rebuild every data file
data:
	@$(PY) fetch_raw.py
	@rm -f .build.skipped
	@for s in $(BUILDS); do \
	  printf '\n== %s\n' "$$s"; \
	  $(PY) $$s | tee .build.out || exit 1; \
	  grep -qiE '^(no |skipped|refusing)' .build.out && echo "$$s" >> .build.skipped || true; \
	done
	@rm -f .build.out
	@printf '\n-- rebuilt. the page loads data/*.json and nothing else.\n'
	@if [ -s .build.skipped ]; then \
	  printf -- '-- these could not rebuild and left their output untouched:\n'; \
	  sed 's/^/     /' .build.skipped; \
	  printf -- '   their inputs are listed in data/raw/README.md.\n'; \
	  rm -f .build.skipped; \
	else \
	  printf -- '-- every build script ran.\n'; \
	fi

## verify the sources against data/raw_manifest.json without downloading
check:
	@$(PY) fetch_raw.py --check

## serve the page locally
serve:
	@echo "http://localhost:$(PORT)"
	@$(PY) -m http.server $(PORT)

## drive the page in a real browser and check what is on screen (Node 18 or later)
test:
	@cd tests && ([ -d node_modules ] || npm ci --no-audit --no-fund) && \
	  (npx playwright install chromium >/dev/null 2>&1 || true) && npm test

## remove the fetched sources; data/*.json and data/raw/README.md stay
clean:
	@rm -f raw-sources.tar.gz
	@find data/raw -mindepth 1 -not -name README.md -not -path 'data/raw' -delete 2>/dev/null || true
	@echo "sources removed. run make data to fetch them again."

## build raw-sources.tar.gz and check it against the manifest before publishing
release-archive:
	@tar --exclude=README.md -czf raw-sources.tar.gz -C data/raw .
	@$(PY) check_archive.py

## print the two API calls that publish the archive, for use without the gh command
release-curl:
	@echo 'export GH_TOKEN=...   # a token with contents:write on the repository'
	@echo
	@echo '# 1. create the release'
	@echo 'curl -sS -X POST -H "Authorization: Bearer $$GH_TOKEN" \'
	@echo '  -H "Accept: application/vnd.github+json" -H "Content-Type: application/json" \'
	@echo '  https://api.github.com/repos/conway1521/open-inequality-atlas/releases \'
	@echo "  -d '{\"tag_name\":\"raw-sources-v1\",\"name\":\"Raw sources v1\"}'"
	@echo
	@echo '# 2. upload the archive to the id that came back'
	@echo 'curl -sS -X POST -H "Authorization: Bearer $$GH_TOKEN" \'
	@echo '  -H "Content-Type: application/gzip" \'
	@echo '  --data-binary @raw-sources.tar.gz \'
	@echo '  "https://uploads.github.com/repos/conway1521/open-inequality-atlas/releases/<ID>/assets?name=raw-sources.tar.gz"'
	@echo
	@echo 'then: python3 fetch_raw.py --force   # proves the published archive is the right one'

## openpyxl, needed only to read the ECB survey workbooks
deps:
	@$(PY) -m pip install --quiet openpyxl && echo "openpyxl ready"

help:
	@awk '/^## /{d=substr($$0,4)} /^[a-z][a-z-]*:/{if(d){printf "  %-18s %s\n", substr($$1,1,length($$1)-1), d; d=""}}' $(MAKEFILE_LIST)
