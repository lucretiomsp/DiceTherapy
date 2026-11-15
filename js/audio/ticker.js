import { TICK_MS } from "./timing.js";

// Calls `fn` every TICK_MS while running. A worker keeps ticking when the main thread is busy or
// throttled (background tab); setInterval is the fallback when workers are unavailable.
export function createTicker(fn) {
  let worker = null, id = null, running = false;
  const startInterval = () => { clearInterval(id); id = setInterval(fn, TICK_MS); };
  try {
    const src = `let id=null;onmessage=e=>{clearInterval(id);if(e.data==='start')id=setInterval(()=>postMessage(0),${TICK_MS})}`;
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
    worker.onmessage = fn;
    worker.onerror = () => { worker = null; if (running) startInterval(); };
  } catch (e) { worker = null; }
  return {
    start() { running = true; if (worker) worker.postMessage("start"); else startInterval(); },
    stop() { running = false; if (worker) worker.postMessage("stop"); clearInterval(id); },
  };
}
