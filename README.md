# FinanceRD API

## Requisitos
- Node.js 18+
- MongoDB instalado localmente O MongoDB Atlas (cloud)

## Instalación

```bash
cd moto-api
npm install
```

## Configurar .env

```env
PORT=3000
MONGODB_URI=mongodb://localhost:8081/BD
JWT_SECRET=*********
```

### Si usas MongoDB Atlas (cloud):
```env
MONGODB_URI=mongodb+srv://<usuario>:<password>@cluster0.xxxxx.mongodb.net/BD
```

## Crear usuario admin

```bash
node src/seed.js
```

## Iniciar servidor

```bash
# Desarrollo (con auto-reload)
npm run dev

# Producción
npm start
```

## Endpoints disponibles

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Usuario actual |
| GET | /api/clientes | Listar clientes |
| POST | /api/clientes | Crear cliente |
| PUT | /api/clientes/:id | Actualizar cliente |
| DELETE | /api/clientes/:id | Eliminar cliente |
| GET | /api/prestamos | Listar préstamos |
| POST | /api/prestamos | Crear préstamo |
| PUT | /api/prestamos/:id | Actualizar préstamo |
| GET | /api/pagos | Listar pagos |
| POST | /api/pagos | Registrar pago |
| GET | /api/reportes/dashboard | Resumen general |
| GET | /api/reportes/cuadre | Cuadre diario |
