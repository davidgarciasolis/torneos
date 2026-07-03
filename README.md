# Torneos MTG

SPA estatica para gestionar torneos de Magic: The Gathering usando Directus.

## Desarrollo

```bash
npm install
npm run dev
```

La app usa por defecto:

```text
https://apipre.mueblesavenida.com
```

Para cambiar la API, crea un `.env.local`:

```bash
VITE_DIRECTUS_URL=https://tu-directus.example.com
```

## Build

```bash
npm run build
```

El resultado queda en `dist/`. La configuracion de Vite usa `base: "/torneos/"`, que corresponde a la URL de GitHub Pages del repositorio:

```text
https://davidgarciasolis.github.io/torneos/
```

No abras `index.html` directamente desde el explorador de archivos: ese es el punto de entrada de desarrollo y necesita Vite. Para probar en local usa `npm run dev`, o `npm run build` seguido de `npm run preview`.

## GitHub Pages

El repo incluye `.github/workflows/deploy-pages.yml`. Al subir cambios a `main` o `master`, GitHub Actions ejecuta:

```bash
npm ci
npm run build
```

Despues publica la carpeta `dist/` en GitHub Pages.

En GitHub, configura el repositorio asi:

1. Ve a `Settings` > `Pages`.
2. En `Build and deployment`, elige `Source: GitHub Actions`.
3. Haz push a `main` o `master`.

No uses `Deploy from a branch` con la raiz del repositorio: GitHub Pages serviria el `index.html` de desarrollo, que depende de Vite y no funciona como pagina estatica.

## Directus

La web inicia sesion con Directus Auth. Los permisos de lectura, creacion, edicion y borrado deben estar configurados en Directus para las colecciones:

- `torneos`
- `equipos`
- `jugadores`
- `jornadas`
- `puntuaciones`
