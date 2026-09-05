# Odr promo — voiceover script

Two voiced versions ship, each cut to its own take (both loudness-normalised
to -16 LUFS from the ElevenLabs files in `public/voice/`):

- `public/voice-indian.mp3` → compositions `Odr` / `OdrPortrait`, 70 s
- `public/voice-system.mp3` → compositions `OdrSystem` / `OdrSystemPortrait`, 66 s

Paragraph start times per voice live in `src/theme.ts` (`VOICES`).

Re-recording? Drop the new file in over one of the two, then re-measure:

```
python3 -m venv out/asr/venv && out/asr/venv/bin/pip install mlx-whisper
out/asr/venv/bin/mlx_whisper public/voice-indian.mp3 --model mlx-community/whisper-small-mlx \
  --word-timestamps True --output-format json --output-dir out/asr --language en
```

Read the start time of the first word of each paragraph from the JSON and
update that voice's `starts` and `end` in `VOICES`. Every scene's beats are fractions of
its length, so nothing else needs touching.

Optional background music goes in `public/music.mp3` (played at 18%).

| Time (voice) | Scene | Line |
|---|---|---|
| 0:00 – 0:06 | Logo | Meet Odr. The restaurant system that runs on the phone already in your pocket. |
| 0:06 – 0:15 | The floor | Your floor, live. Every table, every order, one tap away — on a phone, a tablet, or a browser tab on the counter computer. |
| 0:15 – 0:26 | Order to kitchen | Take the order and fire it. The kitchen sees it instantly, on a screen or on a ticket. |
| 0:26 – 0:38 | The bill | Settle in a tap. GST worked out per rate, invoice numbers in sequence, and a scan-to-pay QR right on the bill. Print on any printer. |
| 0:38 – 0:48 | Beyond the tables | Parcels, Zomato, Swiggy — same kitchen, same bill. And diners can order themselves by scanning the table QR. |
| 0:48 – 1:02 | Sales & reports | Know how you did. Today, this month, or any days you choose. Sales by channel, tax by rate, and a CSV for your accountant. |
| 1:02 – 1:12 | Grow | More than one outlet? Switch in a tap. Your logo, your colours, your name on every bill. |
| 1:12 – 1:20 | Close | Odr. Made in Mangaluru, for every restaurant — big or small. odr dot zowcode dot com, or write to sale at zowcode dot com. |

## Rendering

```
cd apps/promo
bun run render          # all four: out/odr-{indian,system}-{16x9,9x16}.mp4
bun run studio          # live preview in the browser
```

Change the closing tagline or contact line without touching code:

```
bunx remotion render src/index.ts Odr out/odr-16x9.mp4 --props='{"tagline":"...","contact":"odr.zowcode.com","email":"sale@zowcode.com"}'
```

## Higgsfield B-roll (optional)

Generate 4–6 clips of 3–4 seconds, 16:9, and drop them in `public/` as
`broll-1.mp4` … They are not wired in yet; say which scene each belongs to and
I will cut them between the product shots. Prompts that fit the tone:

- "South Indian café at lunch, warm daylight, busy but calm, shallow depth of field, handheld"
- "Close-up of hands tapping a phone at a restaurant counter, thermal receipt printing beside it"
- "Kitchen pass with dosas being plated, steam, amber light"
- "Delivery rider picking up a parcel bag at a café door, evening"
- "Owner looking at a phone at a table after closing, satisfied, soft light"
