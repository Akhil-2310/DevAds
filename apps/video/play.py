#!/usr/bin/env python3
"""
Terminal video player — HD edition.

Two render modes:

  sixel  : real bitmap frames via the Sixel graphics protocol (Windows Terminal
           1.22+, xterm, mlterm, WezTerm, foot, etc.). Hundreds of pixels wide
           -> genuine HD picture in the terminal.
  blocks : 24-bit color Unicode half-blocks (works anywhere with truecolor, but
           low resolution / blocky). Used as a fallback.

Audio plays in sync via ffplay (bundled with ffmpeg). Frames are dropped if
rendering falls behind so the picture stays locked to the audio.

Usage:
    python play.py [video] [--mode auto|sixel|blocks] [--width-px N]
                   [--colors N] [--dither] [--fps F] [--no-audio] [--loop]

Press Ctrl+C to stop.
"""

import argparse
import os
import shutil
import subprocess
import sys
import time

import cv2  # opencv-python

import sixel as sixel_mod

UPPER_HALF = "▀"  # half block for blocks mode


def enable_windows_vt():
    if os.name != "nt":
        return
    try:
        import ctypes

        k = ctypes.windll.kernel32
        h = k.GetStdHandle(-11)
        mode = ctypes.c_uint32()
        k.GetConsoleMode(h, ctypes.byref(mode))
        k.SetConsoleMode(h, mode.value | 0x0004)  # VIRTUAL_TERMINAL_PROCESSING
    except Exception:
        pass


def find_ffplay():
    for name in ("ffplay", "ffplay.exe"):
        p = shutil.which(name)
        if p:
            return p
    return None


def supports_sixel():
    # Best-effort. Windows Terminal (WT_SESSION) 1.22+ supports Sixel.
    if os.environ.get("WT_SESSION"):
        return True
    term = os.environ.get("TERM", "")
    if any(t in term for t in ("mlterm", "foot", "kitty", "wezterm", "xterm")):
        return True
    if os.environ.get("TERM_PROGRAM") in ("WezTerm", "mintty"):
        return True
    return False


def fit_px(vw, vh, maxw, maxh):
    aspect = vw / vh
    w = maxw
    h = int(round(w / aspect))
    if h > maxh:
        h = maxh
        w = int(round(h * aspect))
    return max(2, w), max(2, h)


def fit_blocks(vw, vh, cols, rows):
    """Pixel dims for half-block mode (height counts 2 px per row)."""
    return fit_px(vw, vh, cols, rows * 2)


def frame_to_ansi(rgb):
    H = rgb.shape[0]
    top, bot = rgb[0:H:2], rgb[1:H:2]
    n = min(top.shape[0], bot.shape[0])
    lines = []
    for y in range(n):
        tr_row, br_row = top[y], bot[y]
        cells = []
        for x in range(tr_row.shape[0]):
            tr, tg, tb = tr_row[x]
            br, bg, bb = br_row[x]
            cells.append(f"\x1b[38;2;{tr};{tg};{tb};48;2;{br};{bg};{bb}m{UPPER_HALF}")
        lines.append("".join(cells))
    return "\x1b[H" + "\r\n".join(lines) + "\x1b[0m"


def play(path, mode="auto", width_px=None, colors=256, dither=False,
         fps_override=None, audio=True, loop=False):
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        sys.exit(f"Could not open video: {path}")

    vw = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    vh = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = fps_override or cap.get(cv2.CAP_PROP_FPS) or 30.0

    use_sixel = mode == "sixel" or (mode == "auto" and supports_sixel())

    term = shutil.get_terminal_size((120, 32))
    if use_sixel:
        # Estimate terminal pixel area from cell count (WT default ~9x19 px/cell).
        cell_w, cell_h = 9, 19
        max_w = width_px or int(term.columns * cell_w)
        max_w = max(320, min(max_w, 1600))
        max_h = max(120, (term.lines - 1) * cell_h)
        W, H = fit_px(vw, vh, max_w, max_h)
        kind = f"sixel {W}x{H}px, {colors} colors"
    else:
        W, H = fit_blocks(vw, vh, term.columns, term.lines - 1)
        if H % 2:
            H -= 1
        kind = f"half-blocks {W}x{H//2} cells"

    out = sys.stdout
    ffplay = find_ffplay() if audio else None
    audio_proc = None

    out.write("\x1b[?25l\x1b[?7l\x1b[2J")  # hide cursor, no-wrap, clear
    out.flush()
    try:
        while True:
            if ffplay:
                audio_proc = subprocess.Popen(
                    [ffplay, "-nodisp", "-autoexit", "-loglevel", "quiet", path],
                    stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )

            start = time.time()
            frame_no = 0
            frame_dur = 1.0 / fps
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                frame_no += 1
                target_t = start + frame_no * frame_dur
                now = time.time()
                if now > target_t + frame_dur:  # behind -> drop this frame
                    continue
                resized = cv2.resize(frame, (W, H), interpolation=cv2.INTER_AREA)
                rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
                if use_sixel:
                    out.write("\x1b[H" + sixel_mod.encode_sixel(rgb, colors, dither))
                else:
                    out.write(frame_to_ansi(rgb))
                out.flush()
                now = time.time()
                if now < target_t:
                    time.sleep(target_t - now)

            if audio_proc:
                try:
                    audio_proc.wait(timeout=2)
                except Exception:
                    audio_proc.terminate()
                audio_proc = None

            if not loop:
                break
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    finally:
        out.write("\x1b[0m\x1b[?25h\x1b[?7h\n")  # reset, show cursor, wrap on
        out.flush()
        cap.release()
        if audio_proc:
            try:
                audio_proc.terminate()
            except Exception:
                pass
    return kind


def main():
    enable_windows_vt()
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    ap = argparse.ArgumentParser(description="Play a video in the terminal (HD via Sixel).")
    ap.add_argument("video", nargs="?", default="BLD_Intern_Submission.mp4")
    ap.add_argument("--mode", choices=["auto", "sixel", "blocks"], default="auto")
    ap.add_argument("--width-px", type=int, default=None,
                    help="Sixel image width in pixels (default: fill terminal)")
    ap.add_argument("--colors", type=int, default=256, help="Sixel palette size (16-256)")
    ap.add_argument("--dither", action="store_true", help="Floyd-Steinberg dithering")
    ap.add_argument("--fps", type=float, default=None, help="Override playback FPS")
    ap.add_argument("--no-audio", action="store_true")
    ap.add_argument("--loop", action="store_true")
    args = ap.parse_args()

    if not os.path.exists(args.video):
        sys.exit(f"File not found: {args.video}")

    try:
        play(args.video, args.mode, args.width_px, max(2, min(256, args.colors)),
             args.dither, args.fps, not args.no_audio, args.loop)
    except KeyboardInterrupt:
        sys.stdout.write("\x1b[0m\x1b[?25h\x1b[?7h\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
