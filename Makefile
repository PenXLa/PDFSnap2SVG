all: mupdf
	@rm -rf dist
	@mkdir -p dist
	@cp -r src/* dist/
	@mkdir -p dist/lib/mupdf.js
	@cp -r lib/mupdf.js/dist dist/lib/mupdf.js/dist

mupdf:
	@git submodule update --init --recursive
	@cd lib/mupdf.js && . $$HOME/.nvm/nvm.sh && /opt/emsdk/emsdk activate 3.1.55 &&  npm install

clean:
	rm -rf dist

run:
	python3 -m http.server 8000 --directory dist