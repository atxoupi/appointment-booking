# Diseño: Sistema de Agendamiento de Citas

**Fecha:** 2026-07-10
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto y objetivo

Aplicación web para agendar citas de un negocio (inicialmente una peluquería/barbería),
respetando los horarios/turnos de cada trabajador y evitando solapamientos. El código
debe ser reutilizable: si en el futuro se quiere usar para otro negocio (ej. una clínica
de fisioterapia), se despliega una instancia separada del mismo código — no es un
sistema multi-tenant.

No se usan agentes de IA ni LLMs en tiempo de ejecución. Es una aplicación tradicional
con lógica de negocio determinista.

## Alcance del MVP

- Reserva de citas por clientes (con login) y por el personal (admin/trabajador).
- Gestión de turnos rotativos por trabajador, definidos semana a semana.
- Catálogo de servicios con dos duraciones fijas (30 y 60 min), extensible a futuro.
- Notificaciones por email (confirmación y recordatorio).
- Sin pagos online, sin restricciones de habilidades por trabajador, sin multi-tenant.

## Arquitectura

- **Next.js (App Router)** full-stack, TypeScript de punta a punta.
- **PostgreSQL** como base de datos.
- **Prisma ORM** para el acceso a datos y migraciones.
- **NextAuth.js** para autenticación: credenciales (email + contraseña) y Google OAuth,
  cubriendo los 3 roles: `CLIENT`, `WORKER`, `ADMIN`.
- **Resend** (u otro proveedor equivalente) para envío de emails transaccionales.
- Despliegue como instancia única por negocio (ej. Vercel + Postgres gestionado, o
  Docker en un VPS). Reutilización futura = nuevo despliegue del mismo repo, no
  aislamiento de datos dentro de la misma instancia.

## Modelo de datos

### User (autenticación y roles unificados)
- `id`
- `email`
- `passwordHash` (nullable si el usuario solo usa Google)
- `googleId` (nullable)
- `role`: `CLIENT | WORKER | ADMIN`
- `name`, `lastName`, `phone`
- `createdAt`

### Service (catálogo de servicios)
- `id`, `name`
- `durationMinutes` (30 o 60 por ahora; campo numérico para permitir otras duraciones
  en el futuro sin cambiar el modelo)
- `active`

### ShiftTemplate (turno reutilizable, ej. "Turno mañana", "Turno partido", "Vacaciones")
- `id`, `name`
- `isVacation` (bool): si es `true`, cualquier semana asignada a este turno bloquea
  toda disponibilidad del trabajador esa semana.

### ShiftTemplateRange (franjas horarias por día dentro de un turno)
- `id`, `shiftTemplateId`
- `dayOfWeek` (0-6)
- `startTime`, `endTime`
- Puede haber varias filas para el mismo día (turno partido, ej. 10:00-14:00 y
  16:00-20:00). Si un día no tiene filas, el turno no trabaja ese día.

### WorkerWeekAssignment (turno asignado a cada trabajador en cada semana)
- `id`, `workerId`
- `weekStartDate` (lunes de la semana correspondiente)
- `shiftTemplateId`
- Se pueden crear varias filas de una sola vez (ej. asignar 4 semanas seguidas con
  distintos turnos). Si no existe una fila para una semana dada, el trabajador no
  tiene disponibilidad esa semana completa.

### Appointment (citas)
- `id`
- `clientId`, `workerId`, `serviceId`
- `date`, `startTime`, `endTime`
- `status`: `CONFIRMED | CANCELLED`
- `createdBy`: `CLIENT | STAFF`
- `createdAt`
- Restricción única en base de datos sobre `(workerId, date, startTime)` para citas
  `CONFIRMED`, para prevenir condiciones de carrera en reservas simultáneas.

## Lógica de reservas y disponibilidad

### Flujo del cliente
1. Inicia sesión (o se registra) con email/contraseña o Google.
2. Elige un servicio y una fecha.
3. El sistema calcula las franjas libres (ver algoritmo abajo).
4. El cliente elige un trabajador específico o "cualquiera disponible", y un horario.
5. Confirma → se crea la cita (`CONFIRMED`, `createdBy = CLIENT`) → email de
   confirmación.
6. El cliente puede ver y cancelar sus propias citas futuras desde su cuenta.

### Algoritmo de cálculo de disponibilidad
1. Ubicar la semana (lunes) de la fecha elegida.
2. Para cada trabajador, buscar su `WorkerWeekAssignment` de esa semana.
   - Si no existe la fila, o el turno asignado tiene `isVacation = true`, el
     trabajador no tiene disponibilidad esa semana completa.
3. Tomar los `ShiftTemplateRange` del turno para el día de la semana de la fecha
   elegida → son las ventanas de trabajo de ese trabajador ese día.
4. Restar de esas ventanas las citas `CONFIRMED` existentes de ese trabajador ese día.
5. Generar los huecos resultantes que tengan al menos la duración del servicio
   solicitado, como posibles horas de inicio.

### Flujo de personal (admin/trabajador)
- Usa el mismo algoritmo de disponibilidad al crear una cita manualmente (ej. reserva
  telefónica). No se permite crear citas fuera de los turnos definidos ni solapadas,
  para mantener consistencia con las reservas online.
- El trabajador puede cancelar o reprogramar citas de sus propios clientes.
- El admin puede gestionar todas las citas, de cualquier trabajador.

### Prevención de condiciones de carrera
Al confirmar una cita, la disponibilidad se revalida dentro de una transacción de
base de datos, y se aplica la restricción única `(workerId, date, startTime)` sobre
citas `CONFIRMED`, de forma que dos reservas simultáneas al mismo hueco no puedan
coexistir.

## Roles y permisos

| Acción | Cliente | Trabajador | Admin |
|---|---|---|---|
| Reservar cita propia | Sí | — | — |
| Ver/cancelar sus propias citas | Sí | — | — |
| Crear/cancelar/reprogramar citas de sus clientes | — | Sí | Sí (todas) |
| Ver su propia agenda | — | Sí | Sí (todas) |
| CRUD de servicios | — | — | Sí |
| CRUD de turnos (`ShiftTemplate` + franjas) | — | — | Sí |
| Asignar turnos semanales a trabajadores | — | — | Sí |
| Ver listado de clientes | — | — | Sí |
| Crear cuentas de trabajador | — | — | Sí |

El trabajador solo puede **consultar** su propio turno; únicamente el admin puede
asignarlo o modificarlo.

Los clientes se autoregistran (email/contraseña o Google). Las cuentas de
trabajador y admin no tienen autoregistro: el admin las crea desde su panel
(nombre, email, teléfono, contraseña inicial); la primera cuenta admin se crea
mediante un script de seed.

## Notificaciones

- Email de confirmación al reservar una cita.
- Email de recordatorio antes de la cita (ej. 24h antes), mediante un job programado
  que revise las citas próximas.
- Email de cancelación si el negocio cancela o reprograma una cita.
- WhatsApp queda fuera del MVP (ver "Fuera de alcance").

## Testing

- Tests unitarios para el algoritmo de disponibilidad: cálculo de huecos, turnos,
  vacaciones y solapamientos — es la lógica más crítica del sistema.
- Tests de integración para los endpoints de reserva/cancelación, incluyendo el caso
  de condición de carrera (dos reservas simultáneas al mismo hueco).
- Tests de los CRUD de admin (servicios, turnos, asignación semanal de turnos).

## Fuera de alcance (documentado para el futuro)

- Notificaciones por WhatsApp (vía WhatsApp Business API / Twilio).
- Multi-tenant: varios negocios en la misma instancia/base de datos.
- Pagos online.
- Restricción de servicios por habilidades de cada trabajador (hoy: todos los
  trabajadores pueden realizar todos los servicios).
- El trabajador editando su propio turno (hoy: solo el admin lo asigna).
