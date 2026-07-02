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

El resultado queda en `dist/`. La configuracion de Vite usa `base: "./"` para que los assets funcionen al publicar en GitHub Pages.

## Directus

La web inicia sesion con Directus Auth. Los permisos de lectura, creacion, edicion y borrado deben estar configurados en Directus para las colecciones:

- `torneos`
- `equipos`
- `jugadores`
- `jornadas`
- `puntuaciones`
