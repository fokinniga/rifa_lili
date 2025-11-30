# Guía de Despliegue en Google Cloud Platform (GCP)

Sigue estos pasos para poner tu rifa en internet.

## Paso 1: Crear la Máquina Virtual
1. Entra a [Google Cloud Console](https://console.cloud.google.com/).
2. Ve al menú (tres rayas arriba izquierda) -> **Compute Engine** -> **Instancias de VM**.
3. Haz clic en **Crear Instancia**.
4. Configura lo siguiente:
   - **Nombre:** `rifa-server`
   - **Región:** `us-central1` (Iowa) o `us-east1` (Carolina del Sur). *Esto ayuda a mantenerlo en la capa gratuita.*
   - **Tipo de máquina:** `e2-micro` (en la serie E2).
   - **Disco de arranque:** Haz clic en "Cambiar". Selecciona **Ubuntu** en sistema operativo y **Ubuntu 22.04 LTS** en versión. Tipo de disco: "Disco persistente estándar".
   - **Firewall:** Marca las casillas **"Permitir tráfico HTTP"** y **"Permitir tráfico HTTPS"**.
5. Haz clic en **Crear**.

## Paso 2: Conectarse a la Máquina
1. Espera a que la máquina aparezca con un check verde.
2. Haz clic en el botón **SSH** que aparece en la fila de tu nueva máquina. Se abrirá una ventana negra (terminal).

## Paso 3: Instalar Node.js (Copiar y pegar en la ventana negra)
Copia y pega estos comandos uno por uno en la terminal SSH:

```bash
# 1. Actualizar el sistema
sudo apt update

# 2. Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Instalar PM2 (para mantener la app viva siempre)
sudo npm install -g pm2
```

## Paso 4: Subir tu Código
1. En la ventana del SSH, haz clic en el botón de **engranaje** (o configuración) en la parte superior derecha.
2. Selecciona **"Subir archivo"** (Upload file).
3. Sube el archivo `rifa_deploy.zip` (que crearé para ti en un momento).
4. Una vez subido, ejecuta estos comandos para descomprimirlo e instalarlo:

```bash
# Instalar unzip
sudo apt install unzip

# Descomprimir
unzip rifa_deploy.zip -d rifa

# Entrar a la carpeta
cd rifa

# Instalar dependencias
npm install
```

## Paso 5: Iniciar la Aplicación
```bash
# Iniciar el servidor
pm2 start server.js --name "rifa"

# Guardar para que inicie sola si se reinicia la máquina
pm2 save
pm2 startup
# (Copia y pega el comando que te diga 'pm2 startup' si te pide uno)
```

## Paso 6: Configurar Acceso Público (Puerto 80)
Para que la gente entre sin poner `:3000` al final, haremos un truco rápido para redirigir el tráfico web normal a tu app.

Ejecuta este comando:
```bash
sudo iptables -t nat -A PREROUTING -i ens4 -p tcp --dport 80 -j REDIRECT --to-port 3000
```
*(Nota: Si 'ens4' da error, usa 'ip addr' para ver el nombre de tu interfaz de red, suele ser ens4 o eth0).*

¡Listo! Ahora copia la **IP Externa** de tu máquina (aparece en la consola de Google Cloud) y pégala en tu navegador. Deberías ver tu rifa.
