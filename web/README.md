# Cache Explorer

An optional visual aid for the [Verilog cache project](../README.md).

Open `index.html` in a browser, or run `./run.sh web` from the project root.
For Vercel, select `web` as the Root Directory.

The default scenario shows what happens when block C arrives after
A → B → A. **Next access** runs one CPU request on both caches, and
**Previous** rewinds their contents. Expand **Address bits and controller
cycles** to show the tag, index, offset, and service time. Select a measured
workload to replay it, or use the custom form to queue your own reads and writes.

| File | Purpose |
| --- | --- |
| `index.html`, `style.css`, `script.js` | Page, styling, and controls |
| `model.js` | Cache behavior and address decoding |
| `data.js` | Bundled trace inputs and measured Verilog results |
| `tools/prepare.py`, `tools/test.js` | Refresh the bundle and compare the model to the hardware events |

After changing hardware or a trace, run `./run.sh compare` and then
`./run.sh web-test` from the project root.
