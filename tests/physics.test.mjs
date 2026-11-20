/* LibLabTab · автотесты физического ядра по золотым значениям аудита.
   Запуск: npm test   (node --test tests/) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as PH from '../public/sim/lib/physics.js';

const rel = (got, want, tol, label) => {
  const err = Math.abs(want) > 1e-12 ? Math.abs((got - want) / want) : Math.abs(got - want);
  assert.ok(err <= tol, `${label}: получено ${got}, ожидалось ${want}, отн. ошибка ${err} > ${tol}`);
};

test('математический маятник: T0 и точные периоды', () => {
  const L = 1, g = 9.81;
  rel(PH.pendulumT0(L, g), 2.006067, 1e-5, 'T0');
  const table = [[5,1.00048],[15,1.00430],[30,1.01741],[45,1.03997],[60,1.07318],
                 [90,1.18034],[120,1.37288],[150,1.76220],[170,2.43936],[179,3.90107]];
  for(const [deg, ratio] of table){
    const th = deg * Math.PI / 180;
    rel(PH.pendulumT(L, g, th) / PH.pendulumT0(L, g), ratio, 2e-5, 'T/T0 при ' + deg + '°');
  }
});

test('математический маятник: натяжение, скорость, длина, затухание', () => {
  const m = 1, g = 9.81, L = 1, th0 = Math.PI / 2;
  rel(PH.pendulumTension(m, g, th0, 0), 3 * m * g, 1e-12, 'N внизу при 90° = 3mg');
  rel(PH.pendulumTension(m, g, Math.PI, 0), 5 * m * g, 1e-9, 'N внизу при 180° = 5mg');
  rel(PH.pendulumSpeedBottom(L, g, th0), 4.4294, 1e-4, 'v внизу');
  rel(PH.pendulumLengthForPeriod(2, g), 0.993961, 1e-5, 'секундный маятник');
  assert.ok(PH.pendulumTension(m, g, 120 * Math.PI / 180, 120 * Math.PI / 180) < 0,
    'нить провисает при отпускании с 120°');
  const T0 = PH.pendulumT0(L, g);
  rel(PH.pendulumDampedT(T0, 0.3 / (2 * Math.sqrt(g / L))), 1.0011 * T0, 2e-3, 'предел T при малых амплитудах');
});

test('пружинный маятник: все 13 контрольных точек', () => {
  const m = 0.5, k = 20, g = 9.81;
  rel(PH.springOmega0(m, k), 6.32456, 1e-5, 'ω0');
  rel(PH.springT0(m, k), 0.993459, 1e-5, 'T0');
  rel(PH.springStatic(m, g, k), 0.24525, 1e-5, 'растяжение Земли');
  rel(PH.springStatic(m, 1.62, k), 0.0405, 1e-4, 'растяжение Луны');
  rel(PH.springTwithSpringMass(m, 0.3, k), 1.08828, 1e-5, 'T с массой пружины');
  rel(PH.duffingT(m, k, 1500, 0.08), 0.853133, 1e-5, 'Дуффинг A=8 см');
  rel(PH.duffingT(m, k, 1500, 0.15), 0.664392, 1e-5, 'Дуффинг A=15 см');
  rel(PH.duffingBarrier(k, -600), 0.18257, 1e-4, 'барьер');
  rel(PH.duffingBarrierEnergy(k, -600), 0.16667, 1e-4, 'энергия барьера');
  rel(PH.springCriticalC(m, k), 6.32456, 1e-5, 'c_c');
  rel(PH.springT0(m, k) / Math.sqrt(1 - 0.09), 1.04143, 1e-5, 'T_d при ζ=0,3');
  rel(PH.springQ(0.5, m, k), 6.32456, 1e-5, 'Q');
  rel(PH.springOmegaR(m, k, 0.5), 6.28490, 1e-5, 'ω_r');
  rel(PH.springAmp(0.2, k, m, 0.5, PH.springOmegaR(m, k, 0.5)) * 100, 6.3444, 1e-4, 'A(ω_r), см');
  rel(PH.springEnergy(m, k, 0, 0.08), 0.064, 1e-9, 'E при A=8 см');
});

test('Бернулли: инварианты и потери', () => {
  const rho = 998, mu = 1.002e-3, D1 = 0.1, D2 = 0.05, v1 = 2, p1 = 30000, g = 9.81;
  const Q = v1 * PH.pipeArea(D1), v2 = PH.pipeVelocity(Q, D2);
  rel(v2, 8, 1e-12, 'v2');
  rel(Q * 1000, 15.708, 1e-5, 'Q, л/с');
  rel(PH.bernoulliDp(rho, v1, v2), 29940, 1e-9, 'Δp');
  rel(p1 - PH.bernoulliDp(rho, v1, v2), 60, 1e-6, 'p2');
  rel(PH.headP(p1, rho) + PH.headV(v1), 3.268106, 1e-6, 'полный напор');
  rel(p1 + 0.5 * rho * v1 * v1, 31996, 1e-9, 'Пито');
  rel(PH.reynolds(rho, v1, D1, mu), 199202, 1e-4, 'Re1');
  rel(PH.reynolds(rho, v2, D2, mu), 398403, 1e-4, 'Re2');
  rel(PH.frictionFactor(199202, 1.5e-6, D1), 0.015682, 1e-4, 'f1');
  rel(PH.frictionFactor(398403, 1.5e-6, D2), 0.014046, 1e-4, 'f2');
  rel(PH.bordaCarnotHead(v2, v1) * rho * g, 17964, 1e-4, 'Борда–Карно');
  rel(PH.cavitationV1(p1, 2340, rho, 4), 4.1512, 1e-4, 'порог кавитации');
  rel(PH.frictionFactor(178.6, 1.5e-6, D1), 64 / 178.6, 1e-12, 'ламинарный f = 64/Re');
});

test('Бернулли: Торричелли и опорожнение', () => {
  rel(PH.torricelli(0.5), 3.13209, 1e-5, 'h=0,5');
  rel(PH.torricelli(1), 4.42945, 1e-5, 'h=1');
  rel(PH.torricelli(2), 6.26418, 1e-5, 'h=2');
  rel(PH.jetRange(0.5, 0.5), 1, 1e-12, 'дальность при h=H/2');
  rel(PH.drainTime(0.5, 1e-4, 0.62, 1), 3641.3, 2e-3, 'a = 1 см²');
  const d = 0.0113;
  rel(PH.drainTime(0.5, PH.pipeArea(d), 0.62, 1), 3630.9, 2e-3, 'd = 11,3 мм');
});

test('цепи: RC, делитель, RLC, насыщение', () => {
  rel(PH.rcVoltage(6, 1, 1), 3.7927, 1e-4, 'RC на τ');
  rel(PH.loadedDivider(6, 1e6, 1e6, 1e7), 2.857143, 1e-6, 'нагрузка вольтметра');
  rel(PH.rlcF0(0.01, 1e-5), 503.29, 1e-5, 'f0');
  rel(PH.rlcQ(10, 0.01, 1e-5), 3.162, 1e-4, 'Q');
  rel(PH.saturationIb(6, 100, 100) * 1000, 0.6, 1e-9, 'I_b насыщения, мА');
  rel(PH.ohmFull(6, 10, 1), 0.545455, 1e-6, 'полная цепь');
});

test('масштабы: горизонты, де Бройль, Хаббл', () => {
  rel(PH.schwarzschildRadius(PH.M_SUN) / 1000, 2.953, 1e-3, 'r_s Солнца, км');
  rel(PH.schwarzschildDiameter(PH.M_SUN) / 1000, 5.906, 1e-3, 'диаметр Солнца, км');
  rel(PH.schwarzschildRadius(5.9722e24) * 1000, 8.870, 1e-3, 'r_s Земли, мм');
  rel(PH.schwarzschildDiameter(4.3e6 * PH.M_SUN) / 1e9, 25.40, 2e-3, 'Sgr A*, млн км');
  rel(PH.schwarzschildDiameter(6.5e9 * PH.M_SUN), 3.839e13, 2e-3, 'M87*, м');
  rel(PH.deBroglie(9.1093837e-31, 1e6) * 1e9, 0.7274, 1e-3, 'λ электрона, нм');
  const ball = PH.deBroglie(0.43, 20), man = PH.deBroglie(70, 1);
  rel(ball / PH.L_PLANCK, 4.77, 1e-2, 'мяч в планковских длинах');
  rel(man / PH.L_PLANCK, 0.586, 1e-2, 'человек в планковских длинах');
  assert.ok(ball > PH.L_PLANCK, 'мяч БОЛЬШЕ планковской длины');
  assert.ok(man < PH.L_PLANCK, 'человек меньше планковской длины');
  rel(PH.hubbleRadius(67.4) / PH.LY / 1e9, 14.507, 2e-3, 'радиус Хаббла, млрд св. лет');
  rel(PH.lightTime(1.2742e7) * 1000, 42.5, 1e-3, 'свет через Землю, мс');
  rel(PH.lightTime(PH.AU), 499, 1e-3, 'свет через а.е., с');
});

test('линза: три случая и знаки', () => {
  rel(PH.thinLensF(20, 10), 20, 1e-12, 'd=2F');
  rel(PH.thinLensGamma(20, 10), 1, 1e-12, 'Γ при d=2F');
  rel(PH.thinLensGamma(40, 10), 1 / 3, 1e-12, 'Γ при d=40');
  rel(PH.thinLensF(15, 10), 30, 1e-12, 'f при d=15');
  rel(PH.thinLensGamma(15, 10), 2, 1e-12, 'Γ при d=15');
  assert.equal(PH.thinLensF(10, 10), Infinity, 'd=F → бесконечность');
  assert.ok(PH.thinLensF(20, -10) < 0, 'рассеивающая даёт мнимое');
});

test('бильярд Пенроуза: геометрия смыкания', () => {
  rel(PH.penroseVmax(1, 0.35), 0.871591, 1e-5, 'v_max');
  rel(PH.penroseS(1, 0.35), 1.232616, 1e-5, 'S');
  rel(PH.penroseFocus(1, 0.35), 0.752513, 1e-5, 'фокус');
  rel(PH.penroseSquareSide(1, 0.35), 1.505025, 1e-5, 'сторона квадрата');
});