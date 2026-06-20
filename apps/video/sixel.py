"""Fast-ish Sixel encoder for terminal HD video (numpy + Pillow)."""

import numpy as np
from PIL import Image


def encode_sixel(rgb, ncolors=256, dither=False):
    """Encode an (H, W, 3) uint8 RGB array to a Sixel escape string."""
    img = Image.fromarray(rgb, "RGB").quantize(
        colors=ncolors,
        method=Image.FASTOCTREE,
        dither=Image.Dither.FLOYDSTEINBERG if dither else Image.Dither.NONE,
    )
    pal = img.getpalette() or []
    idx = np.asarray(img, dtype=np.int16)
    H, W = idx.shape

    out = ["\x1bPq", f'"1;1;{W};{H}']

    npal = min(ncolors, len(pal) // 3)
    palarr = np.array(pal[: npal * 3], dtype=np.int32).reshape(-1, 3)
    scaled = (palarr * 100 + 127) // 255
    for i in range(npal):
        r, g, b = scaled[i]
        out.append(f"#{i};2;{r};{g};{b}")

    weights = None
    nbands = (H + 5) // 6
    for band in range(nbands):
        rows = idx[band * 6 : band * 6 + 6]
        h = rows.shape[0]
        if weights is None or len(weights) != h:
            weights = (1 << np.arange(h)).astype(np.int16)[:, None]
        colors = np.unique(rows)
        parts = []
        for c in colors.tolist():
            bits = ((rows == c) * weights).sum(axis=0).astype(np.uint8)
            parts.append(f"#{c}" + _rle(bits))
        out.append("$".join(parts) + "-")

    out.append("\x1b\\")
    return "".join(out)


def _rle(bits):
    """Run-length encode a row of sixel values (0..63) into sixel chars."""
    n = len(bits)
    if n == 0:
        return ""
    change = np.nonzero(np.diff(bits))[0] + 1
    starts = np.concatenate(([0], change))
    ends = np.concatenate((change, [n]))
    vals = bits[starts].tolist()
    runs = (ends - starts).tolist()
    parts = []
    ap = parts.append
    for v, r in zip(vals, runs):
        ch = chr(63 + v)
        if r >= 4:
            ap("!" + str(r) + ch)
        else:
            ap(ch * r)
    return "".join(parts)
