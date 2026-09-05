"use client";

import { useEffect, useRef } from "react";

/**
 * An animated WebGL background: gold leaf diffusing through paper.
 *
 * Adapted from a fragment-shader hero by Matthias Hurrle (@atzedent). The original paints a
 * bright nebula on black with hardcoded orange gradients, which is unreadable behind black type
 * on a cream page, so the field is remapped onto this project's own tokens and clamped to stay
 * light. The math that makes it interesting — domain-warped fractal noise — is unchanged in
 * spirit but cheaper: three octaves rather than five, one warp pass rather than a twelve-step
 * accumulation loop.
 *
 * Deliberate omissions from the source:
 *
 * - Pointer handling. The original attaches four listeners and uploads `move`, `touch`,
 *   `pointerCount` and `pointers` every frame, and its shader reads none of them.
 * - The renderer classes lived inside the hook, so they were redefined on every render. They are
 *   module scope here.
 *
 * Cost control, because a full-screen fragment shader is the easiest way to make a phone hot:
 *
 * - The backing store renders at a fraction of CSS pixels. The field is a soft gradient, so the
 *   loss is invisible and the fragment count drops by roughly four times on mobile.
 * - Every term that is the same for all fragments — where each shooting star is, how bright it
 *   is — is computed once on the CPU and passed in, rather than recomputed per fragment.
 * - A phone renders the same scene as a desktop, at lower resolution. Dropping detail instead
 *   made the two look like different pages.
 * - `mediump` precision, which is materially faster on mobile GPUs than `highp`.
 * - Rendering stops when the hero scrolls out of view or the tab is hidden.
 * - `prefers-reduced-motion` draws exactly one frame and never starts the loop.
 * - No WebGL2, or a lost context, degrades to the flat paper background underneath.
 */

/** A moment with streaks mid-flight, used for the single frame drawn when motion is off. */
const SEED_TIME = 20;

const VERTEX_SRC = `#version 300 es
precision mediump float;
in vec4 position;
void main(){ gl_Position = position; }`;

const FRAGMENT_SRC = `#version 300 es
precision mediump float;

out vec4 O;
uniform vec2 resolution;
uniform float time;
uniform vec3 paper;
uniform vec3 cream;
uniform vec3 gold;

// Dust grid scales, sized on the CPU so motes stay the same size relative to the viewport
// rather than to the canvas. See the note on cellsAcross.
uniform float dustA;
uniform float dustB;

// Shooting stars, resolved on the CPU: xy is the head, zw the tail. Every term that produces
// them — seeds, heading, phase, position — is identical for all fragments, so computing them
// here would be the same arithmetic repeated a hundred thousand times a frame.
#define METEORS 14
uniform vec4 mSeg[METEORS];
uniform float mFade[METEORS];

#define FC gl_FragCoord.xy
#define R resolution
#define MN min(R.x, R.y)

float hash(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + 1.0);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Three octaves. Five was imperceptible once the result is clamped this light.
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++){
    s += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return s;
}

/*
 * Gold dust drifting left.
 *
 * A tiled grid holds one mote per cell, so each fragment only inspects its own cell and the eight
 * around it rather than iterating a particle list. Advancing the sample space to the right makes
 * the motes travel left; each carries its own wobble so the drift reads as random rather than as
 * a sheet sliding across.
 */
float dust(vec2 uv, float scale, float speed, float t){
  vec2 p = uv * scale;
  p.x += t * speed;
  vec2 cell = floor(p), f = fract(p);
  float acc = 0.0;

  // One render pixel, in cell units. A mote thinner than a couple of pixels stops being a mote
  // and becomes shimmer, which is what the field looked like on a phone.
  float unit = scale / MN;

  for (int y = -1; y <= 1; y++){
    for (int x = -1; x <= 1; x++){
      vec2 o = vec2(float(x), float(y));
      vec2 id = cell + o;
      float r1 = hash(id);
      float r2 = hash(id + 17.31);
      vec2 c = o + vec2(r1, r2);
      c.y += 0.18 * sin(t * (0.25 + r1 * 0.8) + r2 * 6.2831);
      c.x += 0.10 * cos(t * (0.20 + r2 * 0.6) + r1 * 6.2831);
      float d = length(f - c);
      // 1.6 pixels, not 2: a radial falloff is antialiased by its own gradient, and a floor high
      // enough to clamp every mote on a phone would take away the size variation along with the
      // shimmer, leaving uniform specks.
      float size = max(mix(0.026, 0.072, r2), unit * 1.6);
      acc += smoothstep(size, 0.0, d) * (0.35 + 0.65 * r1);
    }
  }
  return acc;
}

/*
 * Shooting stars.
 *
 * A meteor travels dead straight and fast. The trail is a taper behind the head, not a path that
 * bends: an earlier version curved each trail along a sine, which read as a snake rather than a
 * meteor. The intertwining comes from stars on differing straight headings crossing one another,
 * which is also how it looks in the sky, not from any single one weaving.
 *
 * All that is left here is the distance from this fragment to a line segment. The segments arrive
 * ready-made.
 */
float meteors(vec2 uv){
  float acc = 0.0;

  // One render pixel in uv units. The core is 0.0015 uv wide, which on a phone is less than half
  // a pixel: the streak falls between the sample points and crawls instead of moving. Holding it
  // to just over a pixel is what makes the stars look the same on a phone as on a desktop.
  float px = 1.0 / MN;

  for (int i = 0; i < METEORS; i++){
    vec2 head = mSeg[i].xy, tail = mSeg[i].zw;

    vec2 pa = uv - tail, ba = head - tail;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float d = length(pa - ba * h);

    // h runs 0 at the tip of the tail to 1 at the head, so the streak narrows and dims behind it.
    // Integer powers rather than pow(): the exponent is constant and pow is not cheap on a phone.
    float h2 = h * h;

    /*
     * Inverse-square falloff rather than a smoothstep, and this is the whole reason the streaks
     * used to look chiselled.
     *
     * smoothstep(w, 0, d) draws a shape with a definite radius: past w there is nothing, and
     * that boundary is a real edge that has to land somewhere on the pixel grid. On a diagonal
     * moving a fraction of a pixel per frame it lands on one row, then the next, and the eye
     * reads the staircase — no width floor fixes that, because the edge exists at every width.
     *
     * A Lorentzian has no boundary at all. It is 1 at the centre, half at w, and thereafter it
     * simply keeps getting smaller, so there is nothing to alias and nothing to step. It is also
     * what the reference this was compared against is doing with its 1/d term.
     */
    float w = max(mix(0.0022, 0.0080, h), px * 1.6);
    float w2 = w * w;
    float d2 = d * d;

    float core = w2 / (d2 + w2) * h2;

    // A wider, fainter halo on the same falloff, which gives the trail its air.
    float gw = w * 4.5 + max(0.0045, px * 3.0);
    float glow = (gw * gw) / (d2 + gw * gw) * h2 * h * 0.45;

    acc += (core + glow) * mFade[i];
  }
  return acc;
}

void main(void){
  vec2 uv = (FC - 0.5 * R) / MN;

  // One domain warp gives the marbled, ink-in-paper drift.
  float t = time * 0.035;
  vec2 q = vec2(fbm(uv * 1.4 + t), fbm(uv * 1.4 + vec2(3.2, 1.7) - t * 0.8));
  float f = fbm(uv * 1.9 + q * 1.5 + t * 0.5);

  vec3 col = mix(paper, cream, smoothstep(0.20, 0.70, f));
  col = mix(col, gold, smoothstep(0.44, 0.95, f) * 0.58);
  col = mix(col, gold, smoothstep(0.72, 0.99, f) * 0.22);

  // Particles darken toward gold. On a light ground additive glow is invisible, so the motes and
  // streaks behave like flecks of leaf on paper rather than light in a night sky.
  float motes = dust(uv, dustA, 0.10, time) + dust(uv, dustB, 0.16, time + 40.0) * 0.75;
  col = mix(col, gold, clamp(motes, 0.0, 1.0) * 0.55);

  /*
   * Meteors cross the whole field, including behind the 11px secondary text. Measured against the
   * darkest tone the field itself produces, a 0.36 blend leaves that text at 4.58:1 — still clear
   * of the AA floor — where 0.6 would have dropped it to 4.0.
   */
  vec3 deepGold = gold * 0.82;
  col = mix(col, deepGold, clamp(meteors(uv), 0.0, 1.0) * 0.36);

  // Settle back toward flat paper at the edges so the panel has no visible boundary.
  float vignette = smoothstep(1.85, 0.05, length(uv * vec2(0.66, 1.0)));
  col = mix(paper, col, vignette);

  O = vec4(col, 1.0);
}`;

/** Shooting stars on screen at once. Each is a line segment; the cost per fragment is small. */
const METEOR_COUNT = 14;

/**
 * Fixed per-star traits.
 *
 * The heights are stratified rather than hashed — star `i` owns the band from `i/N` to `(i+1)/N`
 * of the visible height and is jittered inside it. Fourteen samples of a hash function clump
 * badly, which is exactly what "they are all in the middle" was: not a distribution that happened
 * to look bad, but too few draws to have a distribution at all. Phases are spread by the golden
 * ratio for the same reason, so stars enter at even intervals instead of in bursts.
 */
const METEOR_SEEDS = (() => {
  // A fixed generator, so the seed frame is the same picture every load.
  let state = 0x2f6e2b1;
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const GOLDEN = 0.618033988749895;

  return Array.from({ length: METEOR_COUNT }, (_, i) => ({
    /** Position in the visible height, 0 at the top edge to 1 at the bottom. */
    lane: (i + 0.5) / METEOR_COUNT + (rand() - 0.5) * (0.9 / METEOR_COUNT),
    phase: (i * GOLDEN) % 1,
    speed: rand(),
    angle: rand(),
    length: rand(),
  }));
})();

/** Reads a hex custom property off the document and returns linear 0..1 RGB for the shader. */
function readToken(name: string, fallback: [number, number, number]): [number, number, number] {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const hex = raw.replace("#", "");
  if (hex.length !== 6) return fallback;
  const n = Number.parseInt(hex, 16);
  if (Number.isNaN(n)) return fallback;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

class ShaderField {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private palette = {
    paper: [0.988, 0.984, 0.973] as [number, number, number],
    cream: [0.953, 0.933, 0.89] as [number, number, number],
    gold: [0.788, 0.588, 0.184] as [number, number, number],
  };

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) throw new Error("webgl2-unavailable");
    this.gl = gl;
  }

  private compile(type: number, source: string): WebGLShader | null {
    const { gl } = this;
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  setup(): boolean {
    const { gl } = this;
    const vs = this.compile(gl.VERTEX_SHADER, VERTEX_SRC);
    const fs = this.compile(gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    if (!vs || !fs) return false;

    const program = gl.createProgram();
    if (!program) return false;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    // Shaders are attached to the program; the standalone objects are no longer needed.
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return false;
    }
    this.program = program;

    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]), gl.STATIC_DRAW);

    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    for (const name of ["resolution", "time", "paper", "cream", "gold", "dustA", "dustB"]) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }
    // Array uniforms are addressed by their first element.
    this.uniforms.mSeg = gl.getUniformLocation(program, "mSeg[0]");
    this.uniforms.mFade = gl.getUniformLocation(program, "mFade[0]");

    this.palette = {
      paper: readToken("--paper", this.palette.paper),
      cream: readToken("--raised", this.palette.cream),
      gold: readToken("--glow-bright", this.palette.gold),
    };

    return true;
  }

  /** Grid scales for the two dust layers, recomputed whenever the canvas changes shape. */
  private dustA = 9.5;
  private dustB = 15.0;

  /** Segment endpoints and fade for each star, uploaded once per frame. */
  private seg = new Float32Array(METEOR_COUNT * 4);
  private fade = new Float32Array(METEOR_COUNT);

  resize(cssWidth: number, cssHeight: number, scale: number, cellsAcross: number) {
    const width = Math.max(1, Math.floor(cssWidth * scale));
    const height = Math.max(1, Math.floor(cssHeight * scale));

    /*
     * The dust grid is sized so a fixed number of motes span the viewport width, whatever the
     * canvas is. Fixing the grid in uv units instead ties mote size to the shorter edge, which
     * on a tall phone is the width — so a phone drew the same motes at a third of the size and
     * three times the count, and the field read as grain rather than as leaf. This is the main
     * reason the two looked nothing alike.
     */
    const short = Math.min(width, height);
    this.dustA = (cellsAcross * short) / width;
    this.dustB = this.dustA * 1.6;

    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  /**
   * Place every star for this instant.
   *
   * The spawn area comes from the canvas rather than being a constant, because uv space is
   * normalised to the shorter edge: on a wide screen the visible height is 1 unit, on a tall
   * phone it is over 2. A fixed band of plus or minus half a unit therefore covered the whole
   * of a desktop hero and only the middle half of a phone's — which is what "concentrated in the
   * centre" was.
   *
   * Speed is set in uv units per second rather than as a fraction of the crossing, so a star
   * moves at the same apparent rate on a narrow screen as on a wide one instead of darting.
   */
  private placeMeteors(t: number) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const short = Math.min(w, h);
    const extX = w / (2 * short);
    const extY = h / (2 * short);

    const margin = 0.3;
    const travel = 2 * (extX + margin);

    for (let i = 0; i < METEOR_COUNT; i++) {
      const s = METEOR_SEEDS[i];

      // All rightward, with enough spread in heading that the paths cross.
      const angle = -0.3 + 0.52 * s.angle;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);

      const velocity = 0.42 + 0.3 * s.speed;
      const cycle = (t / (travel / velocity) + s.phase) % 1;

      // The lane is where the star should be halfway through its flight, so the rise or fall
      // over that half is taken back off the entry point. Without this a climbing star spends
      // most of its cycle above the frame.
      const lane = Math.min(1, Math.max(0, s.lane));
      const midY = -(extY + 0.08) + lane * 2 * (extY + 0.08);

      const headX = -(extX + margin) + dx * cycle * travel;
      const headY = midY - dy * travel * 0.5 + dy * cycle * travel;

      const len = 0.34 + 0.22 * s.length;
      const o = i * 4;
      this.seg[o] = headX;
      this.seg[o + 1] = headY;
      this.seg[o + 2] = headX - dx * len;
      this.seg[o + 3] = headY - dy * len;

      // Ease in and out of the wrap so a star never appears or vanishes on a hard edge. Linear
      // ramps still read as a switch at the ends; smoothstepping them removes the click.
      const ramp = (x: number) => {
        const c = Math.min(1, Math.max(0, x / 0.09));
        return c * c * (3 - 2 * c);
      };
      this.fade[i] = Math.min(ramp(cycle), ramp(1 - cycle));
    }
  }

  render(seconds: number) {
    const { gl, program } = this;
    if (!program) return;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.uniform2f(this.uniforms.resolution ?? null, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uniforms.time ?? null, seconds);
    gl.uniform3fv(this.uniforms.paper ?? null, this.palette.paper);
    gl.uniform3fv(this.uniforms.cream ?? null, this.palette.cream);
    gl.uniform3fv(this.uniforms.gold ?? null, this.palette.gold);
    gl.uniform1f(this.uniforms.dustA ?? null, this.dustA);
    gl.uniform1f(this.uniforms.dustB ?? null, this.dustB);

    this.placeMeteors(seconds);
    gl.uniform4fv(this.uniforms.mSeg ?? null, this.seg);
    gl.uniform1fv(this.uniforms.mFade ?? null, this.fade);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose() {
    const { gl } = this;
    if (this.buffer) gl.deleteBuffer(this.buffer);
    if (this.program) gl.deleteProgram(this.program);
    this.program = null;
    this.buffer = null;
  }
}

export function ShaderBackground({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let field: ShaderField;
    try {
      field = new ShaderField(canvas);
      if (!field.setup()) return;
    } catch {
      // No WebGL2, or a blocked context. The flat paper background stands in.
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /*
     * Backing-store scale, in canvas pixels per CSS pixel.
     *
     * A phone deliberately ignores its device pixel ratio. Everything on this field is soft
     * except the streaks, and the streaks are now held to just over a pixel wide inside the
     * shader, so resolution buys nothing here that the shader is not already guaranteeing —
     * while fragment count, and therefore heat, scales with its square. Rendering below one
     * device pixel is what pays for the phone having the same dust and the same fourteen stars
     * as the desktop rather than a reduced version of them.
     */
    const scaleFor = (width: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (width < 640) return 0.7;
      return Math.min((width < 1280 ? 0.75 : 0.7) * dpr, 1.0);
    };

    /*
     * Motes across the viewport width.
     *
     * Fewer on a small screen, so each one is physically bigger. Matching the desktop count on a
     * phone divides the same picture into a third of the space, and the motes come out at about
     * two pixels — present in the buffer, invisible to a person holding the phone.
     */
    const cellsFor = (width: number) => (width < 640 ? 5 : width < 1024 ? 8 : 12);

    const sync = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      field.resize(rect.width, rect.height, scaleFor(rect.width), cellsFor(rect.width));
    };

    let running = false;
    let onScreen = true;
    let startedAt = performance.now();

    const loop = (now: number) => {
      field.render((now - startedAt) * 1e-3);
      frameRef.current = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running || reduceMotion) return;
      running = true;
      startedAt = performance.now() - SEED_TIME * 1000; // continue from the seed frame
      frameRef.current = requestAnimationFrame(loop);
    };

    const stop = () => {
      running = false;
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };

    const evaluate = () => {
      if (onScreen && document.visibilityState === "visible") start();
      else stop();
    };

    sync();
    // Always paint one frame, so reduced-motion users and paused tabs still see the field.
    field.render(SEED_TIME);

    const resizeObserver = new ResizeObserver(() => {
      sync();
      if (!running) field.render(SEED_TIME);
    });
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        evaluate();
      },
      { threshold: 0 },
    );
    intersectionObserver.observe(canvas);

    document.addEventListener("visibilitychange", evaluate);

    const onContextLost = (event: Event) => {
      event.preventDefault();
      stop();
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    evaluate();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", evaluate);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      field.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={`pointer-events-none block h-full w-full ${className}`} />;
}

export default ShaderBackground;
