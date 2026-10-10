# Полёт сквозь Вселенную

Одностраничный сайт со scroll-driven 3D-анимацией: камера летит от Земли через Солнечную систему к
чёрной дыре Стрелец A*, Млечному Пути, скоплению галактик и космической паутине. Всё, что происходит
в кадре, зависит от прокрутки страницы.

**Стек:** Vite, TypeScript, Three.js (WebGL2), postprocessing (pmndrs), GSAP + ScrollTrigger, Lenis.

## Команды

```bash
npm install          # зависимости (Node.js 20.19+)
npm run textures     # скачать и подготовить текстуры (см. ниже)
npm run dev          # dev-сервер, http://localhost:5173
npm run build        # проверка типов + production-сборка в dist/
npm run preview      # раздать dist/ локально
npm test             # юнит-тесты (vitest)
npm run typecheck    # только проверка типов
```

Параметры URL для отладки:

| Параметр | Что делает |
|---|---|
| `?quality=low\|medium\|high` | принудительный уровень качества (без автодетекта и FPS-governor) |
| `?motion=reduced` | режим `prefers-reduced-motion` без смены настроек системы |
| `?debug` | панель lil-gui и счётчик stats-gl |
| `#saturn` (любой id главы) | открыть страницу сразу на нужной главе |

## Текстуры

Готовые текстуры лежат в `public/textures/{4k,2k}/`, список доступных файлов хранится в
`src/config/textures.json`. Этот манифест пишет скрипт, и приложение запрашивает только те файлы,
которые в нём перечислены. Если текстуры нет, объект рисуется процедурным материалом, так что сайт
работает и без неё.

`npm run textures` делает две вещи.

### 1. Скачивает NASA (общественное достояние) автоматически

| Карта | Источник |
|---|---|
| Земля, дневная поверхность | [Blue Marble Next Generation, July](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/) — `world.200407.3x5400x2700.jpg` |
| Земля, ночные огни | [Black Marble 2016](https://earthobservatory.nasa.gov/features/NightLights) — `BlackMarble_2016_3km.jpg` |
| Земля, облака | [Blue Marble Clouds](https://visibleearth.nasa.gov/images/57747/blue-marble-clouds) — `cloud_combined_8192.tif` |
| Земля, рельеф (→ normal map) | [GEBCO topography](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/topography-bathymetry-maps/) — `gebco_08_rev_elev_5400x2700.jpg` |
| Земля, океаны (→ roughness, блик Солнца) | GEBCO bathymetry — `gebco_08_rev_bath_5400x2700.jpg` |
| Луна, цвет | [NASA SVS CGI Moon Kit](https://svs.gsfc.nasa.gov/4720) — `lroc_color_poles_4k.tif` |
| Луна, рельеф (→ normal map) | NASA SVS CGI Moon Kit — `ldem_16_uint.tif` |

Исходники сохраняются в `textures-src/nasa/` (в git не попадают).

### 2. Обрабатывает карты Solar System Scope, скачанные вручную

[Solar System Scope](https://www.solarsystemscope.com/textures/) (лицензия CC BY 4.0) закрыт капчей,
поэтому эти файлы нужно скачать в браузере и положить в `textures-src/sss/`. Подходит любое
разрешение (`2k_`, `4k_` или `8k_`): скрипт возьмёт самое большое и сам сделает версии 4K и 2K.

| Файл на сайте | Объект |
|---|---|
| `8k_mercury.jpg` | Меркурий (normal map строится из яркости) |
| `4k_venus_atmosphere.jpg` | облачный покров Венеры |
| `8k_mars.jpg` | Марс (normal map строится из яркости) |
| `8k_jupiter.jpg` | Юпитер |
| `8k_saturn.jpg` | Сатурн |
| `8k_saturn_ring_alpha.png` | кольца Сатурна (с альфа-каналом) |
| `2k_uranus.jpg` | Уран |
| `2k_neptune.jpg` | Нептун |

После этого запустите `npm run textures` ещё раз.

Ключи скрипта: `--offline` (ничего не качать), `--rebuild` (пересобрать выходные файлы),
`--force` (перекачать NASA и пересобрать всё).

Солнце, спутники Юпитера, астероиды, кометы, чёрная дыра, галактики и космическая паутина
процедурные (GLSL), текстуры для них не нужны.

## Структура

```
index.html                  семантическая разметка всех 13 глав, SEO-мета
scripts/fetch-textures.mjs  пайплайн текстур (sharp)
src/
  main.ts                   сборка приложения и кадровый цикл
  config/                   главы, компоновка сцены, реальные расстояния, уровни качества
  camera/                   якоря глав, keyframe-треки, рельс камеры, параметры окружения
  core/                     renderer, постобработка, ассеты
  scroll/                   Lenis + ScrollTrigger, прогресс полёта
  scenes/                   по модулю на объект + SceneDirector
  shaders/                  GLSL (общий шум, звёзды, Солнце, атмосферы, диск, галактика…)
  ui/                       появление текста, навигация, счётчик расстояния, загрузчик
  styles/main.css
```

## Атрибуция

- Текстуры Земли и Луны: NASA Visible Earth / NASA Earth Observatory, NASA Scientific Visualization
  Studio (общественное достояние).
- Текстуры планет: [Solar System Scope](https://www.solarsystemscope.com/textures/), CC BY 4.0.
- Simplex noise: Ian McEwan, Ashima Arts, Stefan Gustavson (MIT).
- Шрифты Inter и JetBrains Mono: SIL Open Font License.
