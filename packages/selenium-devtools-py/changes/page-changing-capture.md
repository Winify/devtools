---
patch
---

Trace mode reads each page's element tree after every command except known reads, waits and lookups, instead of only after a fixed list of page-changing commands, so a script run through the driver or an `actions` chain shows the page it changed. A test whose last page change is followed by reads also gets one more read of the page it ended on. Reads and waits keep their own rows and show the tree from the last capture before them.
