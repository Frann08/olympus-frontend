# AXTAG · Frontend

Panel React (Vite) conectado a la API de AXTAG. Login real con JWT y ruteo por rol:
**programador**, **trazabilidad** y **cliente**. Incluye la página pública que ve el
teléfono al escanear el NFC.

## Requisitos

El backend tiene que estar corriendo (ver el proyecto `axtag-backend`). Por defecto en
`http://localhost:4000`.

## Arranque

```bash
npm install
cp .env.example .env      # ajustar VITE_API_BASE si el backend no está en localhost:4000
npm run dev
```

Abrí `http://localhost:5173`.

## Usuarios de demo (pass: `axtag1234`)

- `admin@axtag.io` → perfil **programador** (alta de activos, certificados, codificación de tags)
- `traza@axtag.io` → perfil **trazabilidad** (lectura de tags UHF y armado de entradas)
- `cliente@tecpetrol.com` → perfil **cliente** (resumen por vencer + escaneo NFC)

En la pantalla de login hay botones para autocompletar cada usuario.

## Página pública (NFC)

Lo que abre el teléfono al leer el tag es una URL con token. En este frontend se puede
previsualizar en:

```
http://localhost:5173/?tag=<TOKEN>
```

Un token válido se obtiene de la base (tabla `tags`) o de la respuesta del backend. No
requiere login: muestra el activo y sus certificados, y queda registrado el escaneo.

## Notas

- El token de sesión se guarda en `localStorage`. "Cerrar sesión" lo borra.
- El escaneo con pistola en el perfil traza se simula con botones de tags de demo (sus
  EPCs existen en la base). Para integrar un lector real, enviá el EPC leído a
  `POST /api/entradas/:id/scan`.
- Config del backend (CORS): si servís el frontend desde otro dominio, ajustá
  `CORS_ORIGIN` en el backend para permitirlo.
