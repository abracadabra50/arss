PDF=arss-agent-rss-paper.pdf
TEX=main.tex
TECTONIC?=../../../tools/tectonic/tectonic

.PHONY: all clean watch
all: $(PDF)

$(PDF): $(TEX)
	mkdir -p build
	$(TECTONIC) --keep-logs --synctex --outdir build $(TEX)
	cp build/main.pdf $(PDF)

clean:
	rm -rf build $(PDF)

watch:
	while true; do make; sleep 2; done
