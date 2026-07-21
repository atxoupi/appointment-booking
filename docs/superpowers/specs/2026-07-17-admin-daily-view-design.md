# Admin Daily View — Diseño

**Fecha:** 2026-07-17  
**Alcance:** Rediseño de `/admin/appointments` para mostrar un calendario mensual a la izquierda y una cuadrícula diaria por empleado a la derecha.

---

## Objetivo

Reemplazar la lista plana de citas del admin por una vista de agenda diaria con:
- Calendario mensual interactivo (selección de día)
- Cuadrícula horaria 08:00–21:00 en franjas de 30 min
- Una columna por empleado, con sus citas del día seleccionado

---

## API

### `GET /api/admin/daily-view?date=YYYY-MM-DD`

- **Auth:** solo `ADMIN`. Devuelve 403 si el rol no coincide.
- **Query param:** `date` en formato `YYYY-MM-DD`. Si se omite, devuelve 400.

**Respuesta (200):**
```typescript
type DailyViewResponse = DailyViewWorker[];

interface DailyViewWorker {
  id: string;
  name: string;           // "Ana Rodríguez"
  appointments: DailyViewAppointment[];
}

interface DailyViewAppointment {
  id: string;
  startTime: string;      // "HH:mm"
  endTime: string;        // "HH:mm"
  clientName: string;     // nombre completo del cliente
  serviceName: string;    // nombre del servicio
}
```

Todos los trabajadores aparecen en la respuesta aunque no tengan citas ese día (`appointments: []`). Solo se incluyen citas con `status = CONFIRMED`.

---

## Capa de servicio

### `getDailyView(date: Date, db?: PrismaClient): Promise<DailyViewWorker[]>`

Ubicación: `src/lib/appointments-service.ts`

Lógica:
1. Fetcha todos los `User` con `role = WORKER`.
2. Para cada worker, busca sus `Appointment` con `status = CONFIRMED` y `date = params.date`, incluyendo relaciones `client` y `service`.
3. Mapea a `DailyViewWorker` con `clientName = client.name + " " + client.lastName`.
4. Devuelve el array ordenado por nombre de trabajador.

El parámetro `db` sigue el patrón existente del proyecto (default al singleton de Prisma, injectable para tests).

---

## Ruta API

Archivo: `src/app/api/admin/daily-view/route.ts`

- Valida sesión y rol ADMIN.
- Lee y valida el query param `date` (formato `YYYY-MM-DD`).
- Construye un `Date` con `new Date(date + "T00:00:00.000Z")`.
- Llama a `getDailyView(date)` y devuelve JSON.

---

## Frontend

### Página: `src/app/admin/appointments/page.tsx`

Componente cliente. Estado:
- `selectedDate: Date` — inicializado a `new Date()` (hoy)
- `workers: DailyViewWorker[]` — resultado del fetch
- `loading: boolean`

Al montar y cada vez que cambia `selectedDate`, fetcha `GET /api/admin/daily-view?date=YYYY-MM-DD`. Cuando el admin cancela una cita desde la cuadrícula, hace `PATCH /api/appointments/:id` con `{ status: "CANCELLED" }` y re-fetcha.

Layout: dos columnas con `flex`. Columna izquierda fija (~280 px) con el calendario; columna derecha con scroll horizontal para la cuadrícula.

### Componente: `MonthCalendar`

Props: `selectedDate: Date`, `onDateSelect: (date: Date) => void`

Estado interno: `viewMonth` y `viewYear` para la navegación (no necesariamente el mes del día seleccionado).

Renderiza:
- Cabecera: `< Julio 2026 >` con botones prev/next que cambian `viewMonth/viewYear`
- Fila de cabecera: L M X J V S D
- Filas de días: celdas de 1–N del mes, relleno inicial con celdas vacías según el día de semana del día 1
- Hoy: resaltado con borde o fondo diferente
- Día seleccionado: resaltado con fondo sólido

### Componente: `DayGrid`

Props: `workers: DailyViewWorker[]`, `onCancel: (appointmentId: string) => void`

Franjas: array de 26 strings `["08:00", "08:30", ..., "20:30"]`.

Renderiza una `<table>`:
- **Thead:** fila con celda de hora vacía + una `<th>` por trabajador (nombre)
- **Tbody:** una `<tr>` por franja horaria

Para cada fila (franja) × columna (trabajador):
- Si una cita del trabajador empieza en esta franja: renderiza `<td rowSpan={N}>` donde `N = (timeToMinutes(endTime) - timeToMinutes(startTime)) / 30`. Contiene el nombre del cliente, servicio, rango horario y botón "Cancelar".
- Si esta franja está cubierta por el `rowSpan` de una cita anterior: no renderiza ningún `<td>` (el `rowSpan` ya ocupa el espacio).
- Si la franja está libre: renderiza `<td>` vacío con borde sutil.

El tracking de celdas ocupadas se hace con un `Set<string>` de claves `"workerId:HH:mm"` que se puebla al encontrar cada cita.

---

## Testing

### Integration test (nuevo caso en `tests/integration/appointments-service.test.ts`)

- `getDailyView` con un worker sin citas ese día → aparece en resultado con `appointments: []`
- `getDailyView` con un worker con 1 cita CONFIRMED y 1 CANCELLED → solo aparece la CONFIRMED
- `getDailyView` con múltiples workers → todos aparecen ordenados por nombre

---

## Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `src/lib/appointments-service.ts` | Añadir `getDailyView` |
| `src/app/api/admin/daily-view/route.ts` | Crear |
| `src/app/admin/appointments/page.tsx` | Reemplazar |
| `tests/integration/appointments-service.test.ts` | Añadir casos para `getDailyView` |

No se añaden dependencias nuevas.
