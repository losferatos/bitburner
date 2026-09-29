// Einfache Rayleigh/Mie-Einfachstreuung (nach glsl-atmosphere von Rye Terrell, Unlicense)
#define A_PI 3.14159265
#define R_PLANET 6371e3
#define R_ATMOS 6471e3
const vec3 K_RLH = vec3(5.5e-6, 13.0e-6, 22.4e-6);
const float K_MIE = 21e-6;
const float SH_RLH = 8e3;
const float SH_MIE = 1.2e3;

vec2 rsi(vec3 r0, vec3 rd, float sr) {
  float a = dot(rd, rd);
  float b = 2.0 * dot(rd, r0);
  float c = dot(r0, r0) - sr * sr;
  float d = b * b - 4.0 * a * c;
  if (d < 0.0) return vec2(1e5, -1e5);
  return vec2((-b - sqrt(d)) / (2.0 * a), (-b + sqrt(d)) / (2.0 * a));
}

vec3 atmosphere(vec3 r, vec3 r0, vec3 pSun, float iSun, float g) {
  const int iSteps = 16;
  const int jSteps = 8;
  vec2 p = rsi(r0, r, R_ATMOS);
  if (p.x > p.y) return vec3(0.0);
  p.y = min(p.y, rsi(r0, r, R_PLANET).x);
  float iStepSize = (p.y - p.x) / float(iSteps);
  float iTime = 0.0;
  vec3 totalRlh = vec3(0.0), totalMie = vec3(0.0);
  float iOdRlh = 0.0, iOdMie = 0.0;
  float mu = dot(r, pSun), mumu = mu * mu, gg = g * g;
  float pRlh = 3.0 / (16.0 * A_PI) * (1.0 + mumu);
  float pMie = 3.0 / (8.0 * A_PI) * ((1.0 - gg) * (mumu + 1.0)) / (pow(1.0 + gg - 2.0 * mu * g, 1.5) * (2.0 + gg));
  for (int i = 0; i < iSteps; i++) {
    vec3 iPos = r0 + r * (iTime + iStepSize * 0.5);
    float iHeight = length(iPos) - R_PLANET;
    float odStepRlh = exp(-iHeight / SH_RLH) * iStepSize;
    float odStepMie = exp(-iHeight / SH_MIE) * iStepSize;
    iOdRlh += odStepRlh; iOdMie += odStepMie;
    // Erdschatten: Punkte, deren Sonnenstrahl den Planeten trifft, bekommen kein Licht
    vec2 pl = rsi(iPos, pSun, R_PLANET);
    float lit = (pl.x > 0.0 && pl.x < pl.y) ? 0.0 : 1.0;
    float jStepSize = rsi(iPos, pSun, R_ATMOS).y / float(jSteps);
    float jTime = 0.0, jOdRlh = 0.0, jOdMie = 0.0;
    for (int j = 0; j < jSteps; j++) {
      vec3 jPos = iPos + pSun * (jTime + jStepSize * 0.5);
      float jHeight = length(jPos) - R_PLANET;
      jOdRlh += exp(-jHeight / SH_RLH) * jStepSize;
      jOdMie += exp(-jHeight / SH_MIE) * jStepSize;
      jTime += jStepSize;
    }
    vec3 attn = exp(-(K_MIE * (iOdMie + jOdMie) + K_RLH * (iOdRlh + jOdRlh))) * lit;
    totalRlh += odStepRlh * attn;
    totalMie += odStepMie * attn;
    iTime += iStepSize;
  }
  return iSun * (pRlh * K_RLH * totalRlh + pMie * K_MIE * totalMie);
}
