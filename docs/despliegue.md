# Despliegue en la Raspberry

El proyecto no necesita `npm install`: solo Node 22 y el código.

## 1. Colocar el código

```bash
git clone git@github-recetas:ppce-gr/menu_planner.git /home/jarvis/menu_planner
```

## 2. Servicio systemd

```bash
sudo cp deploy/menu-planner.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now menu-planner
curl -s localhost:3090/api/health
```

## 3. Publicarlo gratis

Dos opciones, sin comprar dominio ni abrir puertos en el router:

### Acceso privado (recomendado para uso personal)

```bash
sudo tailscale up
tailscale ip -4        # desde tus dispositivos, entra por esa IP
```

### URL pública gratis con Tailscale Funnel

```bash
tailscale funnel 3090
# te da una URL https://<maquina>.<tailnet>.ts.net
```

Si algún día hay dominio propio, se puede usar **Cloudflare Tunnel** en su
lugar.

## 4. Netlify y otros hostings estáticos (importante)

**Netlify no puede ejecutar esta aplicación tal cual.** Netlify sirve sitios
estáticos y funciones *serverless*, y aquí hay:

- un **servidor Node** con rutas de API,
- una **base de datos SQLite** en disco,
- **sesiones** con cookie,
- llamadas a la IA que pueden tardar decenas de segundos.

Si subes solo `public/` a Netlify verás la interfaz, pero **todo `/api/*`
fallará** (no hay servidor ni base de datos).

Para tener acceso exterior de verdad hay dos caminos:

### A) Túnel a la Raspberry (recomendado, cero cambios)

El servidor sigue aquí, con su SQLite, y se publica por HTTPS:

```bash
# Opción Tailscale (privado o Funnel público)
sudo tailscale up
tailscale funnel 3090        # URL https://<maquina>.<tailnet>.ts.net
```

Necesita `sudo` una vez. Los datos no salen de casa.

### B) Nube (contenedor)

El proyecto trae un `Dockerfile`, así que se puede desplegar en cualquier
hosting de contenedores (Fly.io, Render, Railway, Koyeb…). **Ojo**: hay que
darle un **disco persistente** montado en `DATA_DIR`; si no, SQLite se borra en
cada reinicio.

```bash
docker build -t menu-planner .
docker run -p 3090:3090 -v menu_data:/data menu-planner
```

En un hosting gratuito, revisa si el plan incluye volumen/disco. Si no lo
incluye, hay que usar una base de datos gestionada (y escribir su adaptador,
que es justo lo que permite la arquitectura por puertos).

## 5. Datos y secretos

- La base de datos SQLite y la clave de cifrado viven en `DATA_DIR`.
- Haz copia de `DATA_DIR` (contiene `menu-planner.db` y `.secret`); sin
  `.secret` no se pueden descifrar los tokens guardados.
