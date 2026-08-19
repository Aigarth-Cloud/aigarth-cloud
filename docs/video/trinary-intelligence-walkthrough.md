# Trinary Intelligence — Video Walkthrough

**Title:** Trinary Intelligence: How It Works
**Format:** 6-segment narrated architecture walkthrough
**Total runtime:** ~90 seconds
**Resolution:** 1920×1080 (16:9)
**Voice:** `male-qn-qingse`, neutral

A 90-second narrated walkthrough of the Trinary Intelligence Layer.
Six architecture diagrams, six narration tracks, six video clips.
Designed to be stitched together with `ffmpeg` in 5 minutes.

---

## What this is

A self-contained video tutorial package. Six PNG diagrams + six MP3
narration tracks + six (or three, see [Status](#status)) MP4 video
clips. All you need to assemble the final video is `ffmpeg` (or
any video editor that supports adding audio to video).

The package lives in `docs/video/`:

```
docs/video/
├── trinary-intelligence-walkthrough.md   ← you are here
├── narration-script.md                   ← segment-by-segment script
├── assets/
│   ├── 01_hero.png                       (2K 16:9 hero card)
│   ├── 02_envelope.png                   (2K 16:9 envelope diagram)
│   ├── 03_tissue.png                     (2K 16:9 tissue composition)
│   ├── 04_decide_flow.png                (2K 16:9 sequence diagram)
│   ├── 05_stack.png                      (2K 16:9 stack diagram)
│   ├── 06_monetization.png               (2K 16:9 flow diagram)
│   ├── seg1_clip.mp4                     (image-to-video clip, 6s)
│   ├── seg2_clip.mp4                     (image-to-video clip, 10s)
│   ├── seg3_clip.mp4                     (image-to-video clip, 10s)
│   ├── seg4_clip.mp4                     [see Status]
│   ├── seg5_clip.mp4                     [see Status]
│   ├── seg6_clip.mp4                     [see Status]
│   ├── seg1_narration.mp3                (8s narration)
│   ├── seg2_narration.mp3                (16s narration)
│   ├── seg3_narration.mp3                (22s narration)
│   ├── seg4_narration.mp3                (20s narration)
│   ├── seg5_narration.mp3                (18s narration)
│   └── seg6_narration.mp3                (14s narration)
```

## Status

| Asset | Status | Notes |
|-------|--------|-------|
| 6 architecture diagrams | ✅ generated | 2K 16:9, ~2 MB each |
| 6 narration audio files | ✅ generated | `male-qn-qingse`, neutral |
| `seg1_clip.mp4` (hero) | ✅ generated | 6s, 768P |
| `seg2_clip.mp4` (envelope) | ✅ generated | 10s, 768P |
| `seg3_clip.mp4` (tissue) | ✅ generated | 10s, 768P |
| `seg4_clip.mp4` (/decide flow) | ⚠️ missing | run the regen command below |
| `seg5_clip.mp4` (stack) | ⚠️ missing | run the regen command below |
| `seg6_clip.mp4` (monetization) | ⚠️ missing | run the regen command below |

3 of 6 video clips were generated before the plan's video credits ran
out. The remaining 3 can be regenerated with the prompt templates
below when credits are available, or replaced with a static slideshow
of the architecture diagrams (see [Fallback: image slideshow](#fallback-image-slideshow)).

## Narration script

See [`narration-script.md`](./narration-script.md) for the full
segment-by-segment script. Each segment maps to a single image + a
single video clip + a single audio file.

| Segment | Image | Audio | Clip | Word count | Target sec |
|---------|-------|-------|------|-----------|-----------|
| 1. Hero | 01_hero.png | seg1_narration.mp3 | seg1_clip.mp4 | 38 | 8s |
| 2. Envelope | 02_envelope.png | seg2_narration.mp3 | seg2_clip.mp4 | 65 | 16s |
| 3. Tissue | 03_tissue.png | seg3_narration.mp3 | seg3_clip.mp4 | 86 | 22s |
| 4. /decide flow | 04_decide_flow.png | seg4_narration.mp3 | seg4_clip.mp4 | 76 | 20s |
| 5. Stack | 05_stack.png | seg5_narration.mp3 | seg5_clip.mp4 | 73 | 18s |
| 6. Monetization | 06_monetization.png | seg6_narration.mp3 | seg6_clip.mp4 | 56 | 14s |

## Regenerating the missing clips

When the plan has video credits again, run these prompts through
`gen_videos` (or any image-to-video tool). Each prompt is short and
specific to the visual treatment.

```bash
# seg4 — /decide flow
gen_videos(prompt="Subtle horizontal scroll across the sequence diagram. The arrows glow briefly. Modern technical, dark.",
           input_image_path="docs/video/assets/04_decide_flow.png",
           duration=10, resolution=768P,
           output_file_path="docs/video/assets/seg4_clip.mp4")

# seg5 — stack
gen_videos(prompt="Slow vertical pan top to bottom through the five-layer stack. Each layer lights up sequentially. Modern technical, dark navy.",
           input_image_path="docs/video/assets/05_stack.png",
           duration=10, resolution=768P,
           output_file_path="docs/video/assets/seg5_clip.mp4")

# seg6 — monetization
gen_videos(prompt="Subtle horizontal flow left to right through the four steps. The QUBIC coin icons pulse gently. Modern technical, dark.",
           input_image_path="docs/video/assets/06_monetization.png",
           duration=10, resolution=768P,
           output_file_path="docs/video/assets/seg6_clip.mp4")
```

## Final assembly (with ffmpeg)

If you have ffmpeg installed (e.g. `choco install ffmpeg` on Windows
or `brew install ffmpeg` on macOS), the full assembly is one
command per segment, then a final concat:

```bash
# Combine each video clip with its narration audio.
# ffmpeg will pad/trim the shorter stream to the longer.
ffmpeg -i seg1_clip.mp4 -i seg1_narration.mp3 \
  -c:v copy -c:a aac -shortest seg1_final.mp4
ffmpeg -i seg2_clip.mp4 -i seg2_narration.mp3 \
  -c:v copy -c:a aac -shortest seg2_final.mp4
ffmpeg -i seg3_clip.mp4 -i seg3_narration.mp3 \
  -c:v copy -c:a aac -shortest seg3_final.mp4
ffmpeg -i seg4_clip.mp4 -i seg4_narration.mp3 \
  -c:v copy -c:a aac -shortest seg4_final.mp4
ffmpeg -i seg5_clip.mp4 -i seg5_narration.mp3 \
  -c:v copy -c:a aac -shortest seg5_final.mp4
ffmpeg -i seg6_clip.mp4 -i seg6_narration.mp3 \
  -c:v copy -c:a aac -shortest seg6_final.mp4

# Concatenate all segments.
echo "file 'seg1_final.mp4'
file 'seg2_final.mp4'
file 'seg3_final.mp4'
file 'seg4_final.mp4'
file 'seg5_final.mp4'
file 'seg6_final.mp4'" > concat.txt

ffmpeg -f concat -safe 0 -i concat.txt \
  -c:v libx264 -preset slow -crf 18 \
  -c:a aac -b:a 192k \
  trinary-intelligence.mp4
```

The result is `trinary-intelligence.mp4` — a 90-second 1080p video
with 6 narrated architecture segments. Suitable for YouTube,
LinkedIn, X, the marketing site, and the docs.

## Fallback: image slideshow

If video generation stays unavailable, you can ship a static-image
slideshow with crossfades. The result is less dynamic but is just as
informative:

```bash
# Build a 16:9 slideshow from the 6 diagrams, with crossfade transitions.
ffmpeg -loop 1 -t 8 -i 01_hero.png \
       -loop 1 -t 16 -i 02_envelope.png \
       -loop 1 -t 22 -i 03_tissue.png \
       -loop 1 -t 20 -i 04_decide_flow.png \
       -loop 1 -t 18 -i 05_stack.png \
       -loop 1 -t 14 -i 06_monetization.png \
       -filter_complex \
         "[0][1]xfade=transition=fade:duration=0.5:offset=7.5[v01]; \
          [v01][2]xfade=transition=fade:duration=0.5:offset=23[v02]; \
          [v02][3]xfade=transition=fade:duration=0.5:offset=42.5[v03]; \
          [v03][4]xfade=transition=fade:duration=0.5:offset=62[v04]; \
          [v04][5]xfade=transition=fade:duration=0.5:offset=79.5[v05]" \
       -map "[v05]" -r 30 -pix_fmt yuv420p \
       slideshow.mp4

# Mux with the (already-stitched) narration track.
ffmpeg -i slideshow.mp4 -i all_narration.mp3 \
  -c:v copy -c:a aac -shortest trinary-intelligence-slideshow.mp4
```

## Architecture diagrams

The 6 diagrams were generated with the `image_synthesize` tool at 2K
resolution (16:9). The prompts are in [`narration-script.md`](./narration-script.md#per-segment-timing).

| File | Subject | Visual |
|------|---------|--------|
| `01_hero.png` | Title card | "TRINARY INTELLIGENCE" + 3 glowing dots |
| `02_envelope.png` | Wire contract | JSON envelope field layout, state highlighted |
| `03_tissue.png` | Composition | 3 ANNs feeding a TISSUE box with veto_aware policy |
| `04_decide_flow.png` | Runtime | Sequence diagram, access check → fanout → combine → sign |
| `05_stack.png` | Layered system | 5-layer stack from protocol up to SDK |
| `06_monetization.png` | Product | 4-step flow: listing → decision → billing → invoice |

## What to do with the final video

Once assembled, host on YouTube (unlisted or public), LinkedIn, X, or
embed in the marketing site. Suggested titles:

- **YouTube:** "Trinary Intelligence on Aigarth Cloud — How It Works"
- **LinkedIn:** "How Aigarth turns every ANN into a signed decision"
- **X:** "Three states, one signed envelope, six minutes — how Aigarth's Trinary Intelligence Layer works."

Embed in:
- `apps/web/app/(marketing)/trinary/page.tsx` (new marketing page)
- `docs/INDEX.md` (under the "Video walkthroughs" section — already linked)
- `docs/launches/phase-18-trinary-launch.md` (launch post)

## Time-to-Ship

Approximately 25 minutes from a clean state:

- 6 architecture diagrams: ~3 min (~36 credits, 2K each)
- 6 narration tracks: ~2 min
- 6 video clips: ~6 min when credits are available (3 already generated)
- Companion doc + script: ~10 min
- Final ffmpeg assembly: ~2 min (or done by the user)

## See also

- [`narration-script.md`](./narration-script.md) — the full narration script + per-segment timing
- [`../guides/trinary-intelligence.md`](../guides/trinary-intelligence.md) — written user guide
- [`../launches/phase-18-trinary-launch.md`](../launches/phase-18-trinary-launch.md) — launch summary
- [`../architecture-decisions/003-trinary-protocol-v1.md`](../architecture-decisions/003-trinary-protocol-v1.md) — protocol spec
