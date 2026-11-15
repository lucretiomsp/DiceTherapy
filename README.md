# ScaleDice
Helper for  pseudo random melody generation. Prototyped in Pharo/Coypu, voded with Claude

## Running

The app is plain HTML, CSS and ES modules, with no build step. Browsers do not load modules
from `file://`, so serve the folder:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

Web MIDI also needs a secure context: `localhost` or HTTPS.

## Layout

```
index.html              markup only
css/                    one file per area, linked in cascade order (responsive.css last)
js/
  main.js               entry point (and the Claude artifact hot-reload hook)
  app.js                App: composition root and mediator between model, services and views
  core/                 util (random, clamp…), Emitter (observer), storage
  data/                 tables: SuperCollider scales, tunings, Coypu world rhythms
  theory/               pure music theory: consonance, spelling, scale context, chords
  sequencer/            pure pattern logic: timeline, rhythm, roles, melody
                        + Session, the model all edits go through
  export/coypu.js       the session as a Coypu script
  persistence/          snapshot / restore (memento, v1 and v2)
  audio/                AudioEngine (Web Audio facade), voices (one strategy per lane),
                        ticker (worker clock), Transport (lookahead scheduler, emits events)
  midi/                 MidiOutput: notes, pitch bend, clock, port choice (emits events)
  ui/                   one view per part of the page, LaneInput (pointer/keyboard),
                        shortcuts, toast, code dialog
```

Dependencies only point downwards: `ui` → `audio`/`midi` → `sequencer` → `theory` → `data`/`core`.
Only `app.js` wires layers together; services tell the UI about changes through events, never by
touching the DOM.
