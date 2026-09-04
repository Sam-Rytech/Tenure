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
 * - `mediump` precision, which is materially faster on mobile GPUs than `highp`.
 * - Rendering stops when the hero scrolls out of view or the tab is hidden.
 * - `prefers-reduced-motion` draws exactly one frame and never starts the loop.
 * - No WebGL2, or a lost context, degrades to the flat paper background underneath.
 */

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

// Three octaves. Five was imperceptible here once the result is clamped this light.
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++){
    s += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return s;
}

void main(void){
  vec2 uv = (FC - 0.5 * R) / MN;

  // One domain warp gives the marbled, ink-in-paper drift.
  float t = time * 0.035;
  vec2 q = vec2(fbm(uv * 1.4 + t), fbm(uv * 1.4 + vec2(3.2, 1.7) - t * 0.8));
  float f = fbm(uv * 1.9 + q * 1.5 + t * 0.5);

  vec3 col = mix(paper, cream, smoothstep(0.20, 0.70, f));
  // Gold peaks at a 0.58 blend. Measured against the near-black type token that still leaves
  // better than 10:1, so the field can carry real presence without touching legibility.
  col = mix(col, gold, smoothstep(0.44, 0.95, f) * 0.58);

  // A second, tighter band gives the veins their edge rather than one flat wash.
  col = mix(col, gold, smoothstep(0.72, 0.99, f) * 0.22);

  // Settle back toward flat paper at the edges so the panel has no visible boundary.
  float vignette = smoothstep(1.85, 0.05, length(uv * vec2(0.66, 1.0)));
  col = mix(paper, col, vignette);

  O = vec4(col, 1.0);
}`;

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

    for (const name of ["resolution", "time", "paper", "cream", "gold"]) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }

    this.palette = {
      paper: readToken("--paper", this.palette.paper),
      cream: readToken("--raised", this.palette.cream),
      gold: readToken("--glow-bright", this.palette.gold),
    };

    return true;
  }

  resize(cssWidth: number, cssHeight: number, scale: number) {
    const width = Math.max(1, Math.floor(cssWidth * scale));
    const height = Math.max(1, Math.floor(cssHeight * scale));
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
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

    // A soft gradient survives heavy downsampling, and fragment cost scales with the square of
    // this number, so mobile renders at a quarter of the pixels a naive implementation would.
    const scaleFor = (width: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const base = width < 640 ? 0.45 : width < 1280 ? 0.6 : 0.7;
      return Math.max(0.35, Math.min(base * dpr, 1.1));
    };

    const sync = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      field.resize(rect.width, rect.height, scaleFor(rect.width));
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
      startedAt = performance.now() - 2000; // begin mid-drift rather than from a flat field
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
    field.render(2);

    const resizeObserver = new ResizeObserver(() => {
      sync();
      if (!running) field.render(2);
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
