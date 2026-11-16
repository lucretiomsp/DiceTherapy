# Drum lanes: instrument-aware rhythms

Dice Therapy has 16 lanes: 8 melody lanes (1–8) and 8 drum lanes (9–16). Drum lanes follow
one rule: **every hit is the same note, C3 (MIDI 48), so rolling the dice changes only the
rhythm.** And a drum rhythm is not just random: each drum has a *feel*, a sense of where it
usually plays in a bar. A kick leans on the downbeats, a snare on 2 and 4, hats on the 8ths.

## The drum lanes

| Track | Drum | MIDI ch | Tag on the lane | What its feel favours |
|---|---|---|---|---|
| 9 | Kick | 9 | low drum | beat 1, then beat 3, some syncopated pushes (the "&" of 3) |
| 10 | Snare | 10 | backbeat | beats 2 and 4, a few ghost notes before them |
| 11 | Tom | 11 | fills | almost nothing early in the bar, building towards beat 4 |
| 12 | Rim | 12 | syncopation | the off-16ths (the "a" of 1, the "&" of 2, the "&" of 3): clave-like |
| 13 | Clap | 13 | backbeat | beat 4 strongest, beat 2 often |
| 14 | Closed Hats | 14 | 8ths and 16ths | every 8th, with 16ths in between now and then |
| 15 | Open Hats | 15 | off-beats | the "&" of each beat |
| 16 | Rides | 16 | pulse | quarter notes, with 8ths sometimes |

The track number is the MIDI channel. Melody lanes 1–8 send on channels 1–8.

## How a drum lane is rolled

Each roll (the big die, **Regenerate**, or a lane's own die) makes a new rhythm for the lane.

### 1. Feel or melody-style: a 75 / 25 split

- **75%** of the time the lane follows its **feel** (below). Its tag reads **FEEL**.
- **25%** of the time it is rolled **the way a melody lane is**: a Coypu world rhythm
  (tresillo, clave son, bembé…) or a random one, chosen by the **Rhythm source** slider.
  Its tag reads **WORLD** or **RANDOM**.

The 25% keeps surprises in the kit: a clap on a clave pattern, a kick on a Balkan aksak.

### 2. The feel: a chance for each 16th

A feel is 16 numbers, one per 16th note of a bar, each the chance (0–1) of a hit there:

```
                1    e    &    a    2    e    &    a    3    e    &    a    4    e    &    a
kick        [   1,   0,  .1, .15,  .5,   0,  .2,  .1,  .9,   0, .35,  .1,  .5, .05,  .2, .15 ]
snare       [   0,   0, .05,   0, .95, .05, .05, .15,   0,  .1, .05, .05, .95,  .1, .15, .25 ]
tom         [   0,   0,   0, .05,   0,   0,  .1,  .1,   0, .05,  .1, .15,  .2,  .4, .45,  .5 ]
rim         [  .1,   0,   0,  .6,   0, .15,  .5,   0,   0,  .2,  .6,   0,  .1,  .5,   0,  .2 ]
clap        [   0,   0,   0,   0,  .7,   0,   0, .05,   0,   0,   0,  .1, .95,   0, .05, .15 ]
closedHats  [  .9,  .3,  .9,  .3,  .9,  .3,  .9,  .3,  .9,  .3,  .9,  .3,  .9,  .3,  .9, .35 ]
openHats    [   0,   0,  .8,   0,   0,   0,  .8,   0,   0,   0,  .8,   0,   0,   0,  .8,  .1 ]
rides       [  .9,   0, .45,   0,  .9,   0, .45,  .1,  .9,   0, .45,   0,  .9,   0, .45,  .1 ]
```

### 3. Density: how busy this roll is

Each roll also picks a **density** for the lane, a multiplier from the drum's own range. The
chance of a hit on step *i* is then:

```
p(i) = clamp(feel[i] × density, 0, 1)
```

So one roll can give a sparse kick (only beat 1 and 3) and the next a busy one (with the
pushes). The lane shows the value it got, e.g. `16 kick pattern · density 92%`.

| Drum | Density range |
|---|---|
| Kick | 0.75 – 1.15 |
| Snare | 0.80 – 1.10 |
| Tom | 0.40 – 1.00 |
| Rim | 0.50 – 1.00 |
| Clap | 0.60 – 1.00 |
| Closed Hats | 0.50 – 1.10 |
| Open Hats | 0.45 – 1.00 |
| Rides | 0.60 – 1.10 |

A range above 1 can push the strong steps to certain. That's why a busy kick nearly always
lands on beat 1.

### 4. One bar, repeated, with a fill

Drums groove because they repeat. So a feel roll draws **one bar** (16 steps) and repeats it
across the lane's 64 stored steps. Every **4th bar** gets its own **last beat** (steps 13–16),
drawn again from the same feel, as a small fill. The fill only plays when the lane is longer
than 60 steps, so it shows up with 64- and 128-step patterns.

### 5. Never an empty lane

If a roll leaves no hit inside the lane's length, the drum's strongest step (beat 1 for the
kick, beat 2 for the snare, and so on) is switched on.

### What it produces

These are hit counts per 16th over 500 rolls (feel and melody-style rolls together):

```
             1 e & a 2 e & a 3 e & a 4 e & a
Kick         █ ▁▂▄▁▃▁▇▁▃▂▄▁▂▂
Snare        ▂▁▁▁█▂▂▂▁▂▁▂█▂▂▃
Tom          ▂▁▁▃▂▂▃▃▂▂▃▃▄▅▅█
Rim          ▃▁▁█▁▃▆▁▂▃▆▂▃▅▂▃
Clap         ▂▁▁▂▆▁▂▁▁▁▁▂█▁▁▂
Closed Hats  █▂▇▃▇▃▇▂▇▃▇▃▇▃▇▃
Open Hats    ▂▁█▂▂▂█▁▂▁█▂▂▁█▂
Rides        █▁▄▁▇▁▅▂█▁▄▁█▁▄▂
```

The small bars on the "wrong" steps come from the 25% melody-style rolls.

## Velocity, length and gate

- **Velocity** follows the feel too, so strong positions hit harder:
  `velocity = clamp(0.6 + accent × feel[i] ± 0.05, 0.35, 1)`. `accent` is per drum, from
  0.3 (rim, open hats) to 0.6 (snare).
- **Length**: most drums are one step long. Open hats and rides can ring for 2 to 4 steps.
  Drag a hit to the right to lengthen it, as on a melody lane.
- **Gate** is the share of that length that sounds. Each drum rolls one in its own range
  unless you set it. For the **open hat** it is audible: it rings until the note ends, then
  chokes. Over MIDI, length × gate is how long the note is held.

## Built-in drum sounds

All drums are synthesised: a few Web Audio nodes per hit, no samples.

| Drum | Sound |
|---|---|
| Kick | sine sweeping 165 → 42 Hz, a noise click, and a short duck on the melody synths (sidechain feel) |
| Snare | triangle body 240 → 170 Hz + high-passed noise |
| Tom | sine 180 → 95 Hz + a soft band-passed tap |
| Rim | short 1.7 kHz square click + narrow noise |
| Clap | three band-passed noise slaps 11 ms apart, then a short tail |
| Closed Hats | very short high-passed noise (7.5 kHz) |
| Open Hats | high-passed noise that rings until the note ends |
| Rides | a band-passed noise wash at 8.5 kHz with a faint 3.5 kHz bell |

**Mute local synths** silences these too: then only MIDI goes out.

## Mute and solo

Drum lanes have **M**, **S** and their own die, like melody lanes. A drum that can't be heard
(muted, or left out by a solo) is not played at all. So a muted kick doesn't duck the synths
either.

## Coypu export

Drum lanes export as triggers only, with no notes:

```smalltalk
#(1 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0) asSeq to: #kick.
16 tresillo to: #clap.
```

A world rhythm that nobody edited keeps its Coypu name (`16 tresillo`). Everything else is
written out as gates.

## Saves

A drum lane saves like any lane (gates, velocities, lengths, gate, mute, solo). Saves from
before the drums load with all 8 drum lanes freshly rolled. If such a save had the old fixed
kick switched off, the Kick lane comes back muted.

## Implementation map

| File | What lives there |
|---|---|
| `js/sequencer/drums.js` | `DRUMS` (one entry per drum: key, name, tag, density, accent, lengths, gate range), `FEEL` tables, `FEEL_SHARE` (0.75), `makeDrumRhythm()`, `drumVel()`, `DRUM_NOTE` (48) |
| `js/sequencer/lanes.js` | `LANES` = 8 melody roles + 8 drums in one list; `FIRST_DRUM`, `isDrum(k)` |
| `js/sequencer/session.js` | `#genTrack()` picks `makeDrumRhythm` or `makeRhythm` by lane kind; `#drumHits()` puts C3 and velocities on the gates; step taps on a drum lane add C3 |
| `js/sequencer/rhythm.js` | `makeRhythm()`, the melody-style roll (world or random) used for the 25% |
| `js/audio/drum-voices.js` | `DRUM_VOICES`: one synth function per drum, `(ctx, bus, time, velocity, duration)` |
| `js/audio/engine.js` | a gain and pan per lane; drums go to the drum bus, melodies to the synth bus (ducked by the kick); `playDrum()` |
| `js/audio/transport.js` | each step: a drum lane plays its drum voice and sends C3 on its MIDI channel |
| `js/midi/midi-output.js` | `MIDI_CH`: track number = channel |
| `js/export/coypu.js` | drum lines as triggers |
| `js/persistence/snapshot.js` | save and restore, older saves get drums |
| `js/ui/lanes-view.js`, `css/sequencer.css`, `css/tokens.css` | the drum pane, its compact steps and its colours |

Lanes are generated in order: all melody lanes first, then the drums. So adding or changing
drums never changes what the dice give the melody lanes.

### Changing a feel

Edit a row of `FEEL` in `js/sequencer/drums.js`. For example, a four-on-the-floor kick:

```js
kick: [ 1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0,  1, 0, 0, 0 ],
```

with `density: [1, 1]` so it never thins out.

### More or less surprise

`FEEL_SHARE` in `js/sequencer/drums.js` sets the split: `1` means always the drum's feel,
`0` means always melody-style.

### Adding a drum

1. Add a row to `FEEL` and an entry to `DRUMS` (`js/sequencer/drums.js`).
2. Add its sound to `DRUM_VOICES` (`js/audio/drum-voices.js`), at the same position.
3. Add a `MIX` entry (pan, delay send) in `js/audio/engine.js`.
4. Give it a colour `--<key>` in `css/tokens.css`.
5. Give it a MIDI channel in `MIDI_CH`. All 16 channels are taken, so a 17th lane has to
   share one.
