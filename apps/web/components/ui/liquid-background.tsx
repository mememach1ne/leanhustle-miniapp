'use client';

import { useEffect, useRef } from 'react';

/**
 * WebGL "thick liquid" background, ported from the main site
 * (leanhustle.net) and recoloured to the Poizon teal palette. A small
 * flow-field simulation reacts to pointer movement and a render pass shades
 * it as flowing liquid metal. Falls back to hidden (transparent) when WebGL
 * is unavailable; respects prefers-reduced-motion by freezing time.
 */
export function LiquidBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      (canvas.getContext('webgl') as WebGLRenderingContext | null) ??
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) {
      canvas.style.display = 'none';
      return;
    }

    const vsrc = `attribute vec2 p; varying vec2 vu; void main(){ vu=p*0.5+0.5; gl_Position=vec4(p,0.0,1.0); }`;
    const NOISE = `
      float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+34.56); return fract(p.x*p.y); }
      float noise(vec2 p){ vec2 i=floor(p),f=fract(p); vec2 u=f*f*(3.0-2.0*f);
        float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
        return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }
      float fbm(vec2 p){ float v=0.0,a=0.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
        for(int i=0;i<6;i++){ v+=a*noise(p); p=m*p+0.03; a*=0.5; } return v; }`;

    const simSrc = `
      precision highp float; varying vec2 vu;
      uniform sampler2D u_prev; uniform vec2 u_texel; uniform vec2 u_mouse; uniform vec2 u_vel; uniform float u_aspect;
      void main(){
        vec2 uv=vu;
        vec2 c=texture2D(u_prev,uv).rg-0.5;
        vec2 l=texture2D(u_prev,uv-vec2(u_texel.x,0.0)).rg-0.5;
        vec2 r=texture2D(u_prev,uv+vec2(u_texel.x,0.0)).rg-0.5;
        vec2 t=texture2D(u_prev,uv+vec2(0.0,u_texel.y)).rg-0.5;
        vec2 b=texture2D(u_prev,uv-vec2(0.0,u_texel.y)).rg-0.5;
        vec2 field=c;
        vec2 lap=l+r+t+b-4.0*field;
        field+=lap*0.19;
        vec2 back=uv-field*u_texel*10.0;
        field=mix(field,(texture2D(u_prev,back).rg-0.5),0.3);
        field*=0.985;
        vec2 d=uv-u_mouse; d.x*=u_aspect;
        float infl=exp(-dot(d,d)*55.0);
        field+=u_vel*infl*7.5;
        field=clamp(field,-0.5,0.5);
        gl_FragColor=vec4(field+0.5,0.0,1.0);
      }`;

    // Render pass — recoloured from purple to Poizon teal.
    const renderSrc =
      `
      precision highp float; varying vec2 vu;
      uniform vec2 u_res; uniform float u_time; uniform sampler2D u_flow;
      ` +
      NOISE +
      `
      void main(){
        vec2 uv=(gl_FragCoord.xy-0.5*u_res)/u_res.y;
        float t=u_time*0.05;
        vec2 flow=texture2D(u_flow,vu).rg-0.5;
        vec2 p=uv*2.2 + flow*3.6;
        vec2 q=vec2(fbm(p+t), fbm(p+vec2(5.2,1.3)-t));
        vec2 r=vec2(fbm(p+3.7*q+vec2(1.7,9.2)+0.5*t+flow*2.2), fbm(p+3.7*q+vec2(8.3,2.8)-0.4*t));
        float f=fbm(p+3.7*r);
        float e=0.012;
        float fx=fbm(p+3.7*r+vec2(e,0.0))-f;
        float fy=fbm(p+3.7*r+vec2(0.0,e))-f;
        vec3 n=normalize(vec3(-fx,-fy,0.08));
        vec3 L=normalize(vec3(0.5,0.7,0.55));
        float diff=clamp(dot(n,L)*0.5+0.5,0.0,1.0);
        float spec=pow(clamp(dot(reflect(-L,n),vec3(0.0,0.0,1.0)),0.0,1.0),28.0);
        vec3 c1=vec3(0.010,0.030,0.045);
        vec3 c2=vec3(0.020,0.130,0.150);
        vec3 c3=vec3(0.055,0.360,0.380);
        vec3 c4=vec3(0.220,0.800,0.810);
        float s=clamp(f*1.28+0.04,0.0,1.0);
        vec3 col=mix(c1,c2,smoothstep(0.10,0.5,s));
        col=mix(col,c3,smoothstep(0.46,0.74,s));
        col=mix(col,c4,smoothstep(0.72,0.94,s));
        float irid=pow(smoothstep(0.6,0.96,r.x),2.0);
        col+=vec3(0.08,0.42,0.52)*irid*0.28;
        col*=0.40+0.55*diff;
        col+=spec*vec3(0.85,1.0,1.0)*0.75;
        col+=pow(spec,3.0)*vec3(0.5,0.95,1.0)*0.7;
        col+=length(flow)*vec3(0.16,0.85,0.85)*0.55;
        col*=1.0-0.42*dot(uv,uv);
        gl_FragColor=vec4(col,1.0);
      }`;

    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        // eslint-disable-next-line no-console
        console.warn(gl.getShaderInfoLog(s));
      }
      return s;
    };
    const prog = (fs: string) => {
      const pr = gl.createProgram()!;
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, vsrc));
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(pr);
      return pr;
    };
    const simP = prog(simSrc);
    const renP = prog(renderSrc);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const bindQuad = (pr: WebGLProgram) => {
      const loc = gl.getAttribLocation(pr, 'p');
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    };

    let simW = 2;
    let simH = 2;
    let texA: WebGLTexture | null = null;
    let texB: WebGLTexture | null = null;
    let fboA: WebGLFramebuffer | null = null;
    let fboB: WebGLFramebuffer | null = null;
    let ok = true;

    const makeTex = (w: number, h: number) => {
      const tx = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tx;
    };
    const makeFBO = (tx: WebGLTexture) => {
      const fb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tx, 0);
      return fb;
    };
    const initSim = () => {
      if (texA) {
        gl.deleteTexture(texA);
        gl.deleteTexture(texB);
        gl.deleteFramebuffer(fboA);
        gl.deleteFramebuffer(fboB);
      }
      simW = Math.max(2, Math.floor(window.innerWidth * 0.5));
      simH = Math.max(2, Math.floor(window.innerHeight * 0.5));
      texA = makeTex(simW, simH);
      texB = makeTex(simW, simH);
      fboA = makeFBO(texA);
      fboB = makeFBO(texB);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        ok = false;
        return;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboA);
      gl.viewport(0, 0, simW, simH);
      gl.clearColor(0.5, 0.5, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
      gl.viewport(0, 0, simW, simH);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };
    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * 0.62);
      canvas.height = Math.floor(window.innerHeight * 0.62);
      initSim();
    };
    window.addEventListener('resize', resize);
    resize();
    if (!ok) {
      canvas.style.display = 'none';
      window.removeEventListener('resize', resize);
      return;
    }

    let t01 = [0.5, 0.5];
    const p01 = [0.5, 0.5];
    let prev = [0.5, 0.5];
    const vel = [0, 0];
    const setT = (x: number, y: number) => {
      t01 = [x / window.innerWidth, 1.0 - y / window.innerHeight];
    };
    const onPointer = (e: PointerEvent) => setT(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      if (e.touches[0]) setT(e.touches[0].clientX, e.touches[0].clientY);
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });

    const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    let running = true;
    const onVisibility = () => {
      running = !document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibility);
    const start = performance.now();
    const clampLen = (v: number[], m: number) => {
      const len = Math.hypot(v[0], v[1]);
      if (len > m) {
        v[0] *= m / len;
        v[1] *= m / len;
      }
      return v;
    };

    const simU = {
      prev: gl.getUniformLocation(simP, 'u_prev'),
      texel: gl.getUniformLocation(simP, 'u_texel'),
      mouse: gl.getUniformLocation(simP, 'u_mouse'),
      vel: gl.getUniformLocation(simP, 'u_vel'),
      aspect: gl.getUniformLocation(simP, 'u_aspect'),
    };
    const renU = {
      res: gl.getUniformLocation(renP, 'u_res'),
      time: gl.getUniformLocation(renP, 'u_time'),
      flow: gl.getUniformLocation(renP, 'u_flow'),
    };

    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!running) return;
      p01[0] += (t01[0] - p01[0]) * 0.12;
      p01[1] += (t01[1] - p01[1]) * 0.12;
      vel[0] = p01[0] - prev[0];
      vel[1] = p01[1] - prev[1];
      prev = [p01[0], p01[1]];
      clampLen(vel, 0.06);

      gl.useProgram(simP);
      bindQuad(simP);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
      gl.viewport(0, 0, simW, simH);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texA);
      gl.uniform1i(simU.prev, 0);
      gl.uniform2f(simU.texel, 1.0 / simW, 1.0 / simH);
      gl.uniform2f(simU.mouse, p01[0], p01[1]);
      gl.uniform2f(simU.vel, vel[0], vel[1]);
      gl.uniform1f(simU.aspect, simW / simH);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const tt = texA;
      texA = texB;
      texB = tt;
      const ff = fboA;
      fboA = fboB;
      fboB = ff;

      gl.useProgram(renP);
      bindQuad(renP);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texA);
      gl.uniform1i(renU.flow, 0);
      gl.uniform2f(renU.res, canvas.width, canvas.height);
      gl.uniform1f(renU.time, reduce ? 10.0 : (now - start) * 0.001);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('touchmove', onTouch);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-20 h-full w-full"
    />
  );
}
