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
curl -s localhost:3080/api/health
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
tailscale funnel 3080
# te da una URL https://<maquina>.<tailnet>.ts.net
```

Si algún día hay dominio propio, se puede usar **Cloudflare Tunnel** en su
lugar.

## 4. Datos y secretos

- La base de datos SQLite y la clave de cifrado viven en `DATA_DIR`.
- Haz copia de `DATA_DIR` (contiene `menu-planner.db` y `.secret`); sin
  `.secret` no se pueden descifrar los tokens guardados.
