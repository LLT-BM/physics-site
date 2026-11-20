/* LibLabTab · чистое физическое ядро без DOM.
   Единый источник формул для симуляций и автотестов.
   Подключение в браузере: <script src="/sim/lib/physics.js"></script> → window.LLTphysics
   Подключение в Node:     import * as PH from '../public/sim/lib/physics.js' */

export const G = 9.81;
export const PATM = 101325;
export const C_LIGHT = 299792458;
export const G_NEWTON = 6.6743e-11;
export const H_PLANCK = 6.62607015e-34;
export const M_SUN = 1.98847e30;
export const LY = 9.4607304725808e15;
export const AU = 1.495978707e11;
export const L_PLANCK = 1.616255e-35;

/* Полный эллиптический интеграл 1-го рода через АГМ */
export function ellipticK(k){
  let a = 1, b = Math.sqrt(Math.max(0, 1 - k * k));
  for(let i = 0; i < 60; i++){
    const an = (a + b) / 2, bn = Math.sqrt(a * b);
    a = an; b = bn;
    if(Math.abs(a - b) < 1e-16) break;
  }
  return Math.PI / (2 * a);
}

/* ── математический маятник ───────────────────────────────────────── */
export const pendulumT0 = (L, g = G) => 2 * Math.PI * Math.sqrt(L / g);
export const pendulumT = (L, g, th0) =>
  4 * Math.sqrt(L / g) * ellipticK(Math.sin(Math.min(Math.abs(th0), Math.PI - 1e-9) / 2));
export const pendulumTension = (m, g, th0, th) => m * g * (3 * Math.cos(th) - 2 * Math.cos(th0));
export const pendulumSpeedBottom = (L, g, th0) => Math.sqrt(2 * g * L * (1 - Math.cos(th0)));
export const pendulumLengthForPeriod = (T, g = G) => g * Math.pow(T / (2 * Math.PI), 2);
export const pendulumDampedT = (T0, zeta) => T0 / Math.sqrt(Math.max(1e-12, 1 - zeta * zeta));

/* ── пружинный маятник ────────────────────────────────────────────── */
export const springOmega0 = (m, k) => Math.sqrt(k / m);
export const springT0 = (m, k) => 2 * Math.PI * Math.sqrt(m / k);
export const springStatic = (m, g, k) => m * g / k;
export const springTwithSpringMass = (m, ms, k) => 2 * Math.PI * Math.sqrt((m + ms / 3) / k);
export const springStaticWithMass = (m, ms, g, k) => (m + ms / 2) * g / k;
export function duffingT(m, k, beta, A){
  const e = beta / m, w0s = k / m, W = w0s + e * A * A;
  if(W <= 0) return NaN;
  const q = e * A * A / (2 * W);
  if(q < 0 || q >= 1) return NaN;
  return 4 * ellipticK(Math.sqrt(q)) / Math.sqrt(W);
}
export const duffingBarrier = (k, beta) => beta < 0 ? Math.sqrt(k / Math.abs(beta)) : Infinity;
export const duffingBarrierEnergy = (k, beta) => beta < 0 ? k * k / (4 * Math.abs(beta)) : Infinity;
export const springCriticalC = (m, k) => 2 * Math.sqrt(m * k);
export const springZeta = (c, m, k) => c / springCriticalC(m, k);
export const springQ = (c, m, k) => springCriticalC(m, k) / (2 * c);
export const springOmegaR = (m, k, c) => {
  const z = springZeta(c, m, k);
  return springOmega0(m, k) * Math.sqrt(Math.max(0, 1 - 2 * z * z));
};
export const springAmp = (F0, k, m, c, w) => F0 / Math.sqrt(Math.pow(k - m * w * w, 2) + Math.pow(c * w, 2));
export const springEnergy = (m, k, beta, A, v = 0) => 0.5 * m * v * v + 0.5 * k * A * A + 0.25 * beta * Math.pow(A, 4);

/* ── гидродинамика ────────────────────────────────────────────────── */
export const pipeArea = D => Math.PI * D * D / 4;
export const pipeVelocity = (Q, D) => Q / pipeArea(D);
export const bernoulliDp = (rho, v1, v2) => 0.5 * rho * (v2 * v2 - v1 * v1);
export const headP = (p, rho, g = G) => p / (rho * g);
export const headV = (v, g = G) => v * v / (2 * g);
export const reynolds = (rho, v, D, mu) => rho * v * D / mu;
export function frictionFactor(Re, eps, D){
  if(!(Re > 1)) return 0;
  if(Re < 2300) return 64 / Re;
  const lg = Math.log10(eps / (3.7 * D) + 5.74 / Math.pow(Re, 0.9));
  return 0.25 / (lg * lg);
}
export const bordaCarnotHead = (v2, v3, g = G) => Math.pow(v2 - v3, 2) / (2 * g);
export const torricelli = (h, g = G) => Math.sqrt(2 * g * h);
export const jetRange = (h, y) => 2 * Math.sqrt(Math.max(0, h) * Math.max(0, y));
export const drainTime = (At, a, Cd, H, g = G) => (At / (Cd * a)) * Math.sqrt(2 * H / g);
export const cavitationV1 = (p1, pv, rho, areaRatio, patm = PATM) =>
  Math.sqrt(2 * (p1 + patm - pv) / (rho * (areaRatio * areaRatio - 1)));

/* ── электрические цепи ───────────────────────────────────────────── */
export const rcVoltage = (E, t, tau) => E * (1 - Math.exp(-t / tau));
export const loadedDivider = (E, R1, R2, Rv) => {
  const par = R2 * Rv / (R2 + Rv);
  return E * par / (R1 + par);
};
export const rlcF0 = (L, C) => 1 / (2 * Math.PI * Math.sqrt(L * C));
export const rlcQ = (R, L, C) => Math.sqrt(L / C) / R;
export const saturationIb = (E, beta, R) => E / (beta * R);
export const ohmFull = (E, R, r) => E / (R + r);

/* ── масштабы ─────────────────────────────────────────────────────── */
export const schwarzschildRadius = (M, g = G_NEWTON, c = C_LIGHT) => 2 * g * M / (c * c);
export const schwarzschildDiameter = (M) => 2 * schwarzschildRadius(M);
export const horizonMassForWindow = (D, g = G_NEWTON, c = C_LIGHT) => (D / 2) * c * c / (2 * g);
export const deBroglie = (m, v) => H_PLANCK / (m * v);
export const lightTime = (d, c = C_LIGHT) => d / c;
export const hubbleRadius = (H0kmSMpc) => {
  const H0 = H0kmSMpc * 1000 / 3.0856775814913673e22;
  return C_LIGHT / H0;
};

/* ── оптика ───────────────────────────────────────────────────────── */
export const thinLensF = (d, F) => (Math.abs(d - F) < 1e-12 ? Infinity : F * d / (d - F));
export const thinLensGamma = (d, F) => (Math.abs(d - F) < 1e-12 ? Infinity : F / (d - F));

/* ── бильярд Пенроуза ─────────────────────────────────────────────── */
export const penroseVmax = (R, p) => -2 * p + 2 * Math.sqrt(p * p + p * R * Math.SQRT2);
export const penroseS = (R, p) => Math.SQRT2 * penroseVmax(R, p);
export const penroseFocus = (R, p) => R - p / Math.SQRT2;
export const penroseSquareSide = (R, p) => 2 * penroseFocus(R, p);

/* Браузерная витрина */
if(typeof window !== 'undefined'){
  window.LLTphysics = {
    G, PATM, C_LIGHT, G_NEWTON, H_PLANCK, M_SUN, LY, AU, L_PLANCK,
    ellipticK, pendulumT0, pendulumT, pendulumTension, pendulumSpeedBottom,
    pendulumLengthForPeriod, pendulumDampedT,
    springOmega0, springT0, springStatic, springTwithSpringMass, springStaticWithMass,
    duffingT, duffingBarrier, duffingBarrierEnergy, springCriticalC, springZeta, springQ,
    springOmegaR, springAmp, springEnergy,
    pipeArea, pipeVelocity, bernoulliDp, headP, headV, reynolds, frictionFactor,
    bordaCarnotHead, torricelli, jetRange, drainTime, cavitationV1,
    rcVoltage, loadedDivider, rlcF0, rlcQ, saturationIb, ohmFull,
    schwarzschildRadius, schwarzschildDiameter, horizonMassForWindow, deBroglie,
    lightTime, hubbleRadius, thinLensF, thinLensGamma,
    penroseVmax, penroseS, penroseFocus, penroseSquareSide
  };
}