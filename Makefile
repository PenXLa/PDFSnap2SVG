all:
	@rm -rf dist
	@mkdir -p dist
	@cp html/* dist/
	@cp -r js dist/
	@cp -r css dist/
	@mkdir -p dist/lib/mupdf.js
	@cp -r lib/mupdf.js/dist dist/lib/mupdf.js/dist

clean:
	rm -rf dist

run:
	python3 -m http.server 8000 --directory dist