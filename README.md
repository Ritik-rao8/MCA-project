# Two-way set-associative cache with LRU

This MCA project implements and compares two Verilog caches with the same
64-byte capacity.
Direct mapping gives each block one possible line. The two-way cache gives
each block two places in its set and replaces the least recently used (LRU)
block when both places are full.

## Run the Verilog project

Install Icarus Verilog, then run `./run.sh demo` from the project root. On
macOS with Homebrew, use `brew install icarus-verilog`. Both controllers
read A → B → A → C → A → B. In the two-way cache, the second read of A
makes B the least recently used block, so C evicts B. The final reads
verify that A hits and B misses. [Demo and waveform notes](docs/evaluation.md)

| Command | What you get |
| --- | --- |
| `./run.sh demo` | Each read's hit or miss, returned byte, and service cycles, followed by totals for each cache. |
| `./run.sh test` | A regression summary for both RTL designs at memory delays of 1, 3, and 7 cycles, followed by the demo. |
| `./run.sh compare` | Side-by-side hit rates and service cycles for seven shared workloads, checked against an independent Python model. Requires Python 3. |
| `./run.sh synth` | Generic cell counts and netlist verification results for both controllers. Requires Yosys and Python 3. |

See the [measured comparison](results/comparison.md) and
[technical report](docs/technical-report.md) for the results and methodology.

## Repository layout

```text
.
├── .gitattributes
├── .gitignore
├── README.md
├── run.sh
├── verilog/
│   ├── rtl/        # Direct-mapped and two-way LRU controllers
│   ├── sim/        # Testbenches, memory model, and trace checker
│   └── traces/     # Seven shared workloads
├── results/
│   ├── comparison.csv
│   ├── comparison.md
│   ├── review.md
│   ├── runs/       # Summary and per-request CSVs
│   ├── synthesis/  # Yosys cell reports
│   └── waveforms/  # Demo VCD captures
├── docs/
│   ├── evaluation.md
│   └── technical-report.md
├── reports/        # IEEE reports and LaTeX sources
└── web/            # Cache Explorer site, assets, and deployment config
    ├── fonts/
    └── tools/
```

The run script writes local executables, logs, and gate netlists to the
Git-ignored `build/` directory.

## Submission deliverables

| Phase | What to submit and demonstrate |
| --- | --- |
| Phase I | [IEEE prototype report](reports/phase-i.pdf), a video demonstrating the running Verilog prototype, and the project repository. |
| Phase II | [IEEE evaluation report](reports/phase-ii.pdf) and the repository with both Verilog designs, shared testbench and traces, comparison results, and synthesis evidence. |

Confirm the five author names and individual contributions, then rebuild both
PDFs using the [report instructions](reports/README.md). Add the prototype
video link after recording.

## Optional browser visualizer

[Cache Explorer](web/index.html) lets you step through the same workloads in
a browser. Open `web/index.html` offline or see the
[website README](web/README.md) for local server and hosting instructions.
