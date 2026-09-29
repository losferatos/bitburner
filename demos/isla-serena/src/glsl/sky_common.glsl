// Gemeinsame Himmelsfunktionen: Wolken, Sterne, Mond, Nebel. Wird von Himmel und Ozean benutzt.
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uSunDisk;      // Farbe/Intensität Sonnenscheibe (HDR)
uniform vec3 uCloudSun;     // Sonnenlicht in Wolkenhöhe
uniform vec3 uCloudAmb;     // Himmelslicht für Wolken
uniform vec3 uFogColor;
uniform vec3 uFogSunColor;
uniform vec4 uFogParams;
uniform float uNight;
uniform float uTime;
uniform float uCloudCover;
uniform sampler2D uNoise;
uniform samplerCube uSkyCube;

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 fogBlend(vec3 col, vec3 ro, vec3 rd, float dist) {
  float a = uFogParams.x, b = uFogParams.y;
  float ry = rd.y;
  if (abs(ry) < 1e-4) ry = 1e-4;
  float fogAmt = a * exp(-max(ro.y, -20.0) * b) * (1.0 - exp(-dist * ry * b)) / (ry * b);
  float f = 1.0 - exp(-fogAmt);
  float s = pow(max(dot(rd, uSunDir), 0.0), uFogParams.z);
  vec3 fc = mix(uFogColor, uFogSunColor, s);
  return mix(col, fc, clamp(f, 0.0, uFogParams.w));
}

float cloudDens(vec2 p) {
  vec2 w = vec2(uTime * 0.0035, uTime * 0.0011);
  float n = texture(uNoise, p * 0.045 + w).r * 0.62
          + texture(uNoise, p * 0.13 - w * 1.6).b * 0.30
          + texture(uNoise, p * 0.41 + w * 2.4).g * 0.14
          + texture(uNoise, p * 1.3 - w * 3.0).a * 0.06;
  return clamp((n - (1.02 - uCloudCover * 0.62)) * 3.2, 0.0, 1.0);
}

vec4 cloudLayer(vec3 ro, vec3 rd) {
  if (rd.y < 0.01) return vec4(0.0);
  float t = (1900.0 - ro.y) / rd.y;
  vec3 hp = ro + rd * t;
  vec2 p = hp.xz / 1000.0;
  float d = cloudDens(p);
  if (d <= 0.001) return vec4(0.0);
  vec3 sd = normalize(vec3(uSunDir.x, max(uSunDir.y, 0.02), uSunDir.z));
  float dl = cloudDens(p + sd.xz / sd.y * 0.12) + 0.5 * cloudDens(p + sd.xz / sd.y * 0.32);
  float lightT = exp(-dl * 2.2);
  float mu = dot(rd, uSunDir);
  float phase = 0.55 + 2.2 * pow(max(mu, 0.0), 12.0) + 0.3 * pow(max(mu, 0.0), 2.0);
  vec3 col = uCloudAmb * (1.05 - 0.35 * d) + uCloudSun * lightT * phase;
  float a = smoothstep(0.0, 0.45, d) * smoothstep(0.01, 0.09, rd.y);
  col = fogBlend(col, ro, rd, min(t, 40000.0) * 0.6);
  return vec4(col, a);
}

vec3 starField(vec3 rd) {
  vec3 p = rd * 300.0;
  vec3 id = floor(p);
  vec3 f = fract(p) - 0.5;
  float h = hash13(id);
  float star = step(0.994, h) * smoothstep(0.28, 0.0, length(f));
  float tw = 0.7 + 0.3 * sin(uTime * (2.0 + h * 5.0) + h * 40.0);
  // Milchstraßen-Band
  float band = exp(-pow(dot(rd, normalize(vec3(0.3, 0.2, 0.9))) * 3.2, 2.0));
  float dust = texture(uNoise, rd.xz * 1.3 + rd.y).r;
  vec3 mw = vec3(0.35, 0.38, 0.5) * band * dust * 0.06;
  vec3 sc = mix(vec3(1.0, 0.85, 0.7), vec3(0.75, 0.85, 1.0), fract(h * 91.0));
  return sc * star * tw * (0.6 + 3.0 * fract(h * 17.0)) + mw;
}

vec3 skyColor(vec3 ro, vec3 rd, bool withSun) {
  vec3 d = rd;
  d.y = max(d.y, 0.0005);
  vec3 col = texture(uSkyCube, normalize(d)).rgb;
  float horizonFade = smoothstep(0.0, 0.3, rd.y + 0.02);
  if (uNight > 0.0) col += starField(rd) * uNight * horizonFade * 0.9;
  // Mond
  float md = dot(rd, uMoonDir);
  float moon = smoothstep(0.99955, 0.99965, md);
  if (moon > 0.0) {
    vec3 mp = rd - uMoonDir;
    float maria = texture(uNoise, mp.xy * 22.0 + 0.3).r;
    col += vec3(0.9, 0.93, 1.0) * moon * (1.6 + 0.8 * maria) * (0.2 + uNight * 2.0);
  }
  col += vec3(0.5, 0.6, 0.8) * pow(max(md, 0.0), 800.0) * 0.4 * uNight;
  if (withSun) {
    float sd = dot(rd, uSunDir);
    col += uSunDisk * smoothstep(0.99988, 0.99995, sd);
  }
  vec4 cl = cloudLayer(ro, rd);
  col = mix(col, cl.rgb, cl.a);
  // unter dem Horizont in Dunst übergehen
  col = mix(uFogColor, col, smoothstep(-0.04, 0.02, rd.y));
  return col;
}
