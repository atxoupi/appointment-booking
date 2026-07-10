import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "citas@example.com";

export interface AppointmentEmailDetails {
  serviceName: string;
  workerName: string;
  date: string; // "YYYY-MM-DD"
  startTime: string;
}

export async function sendAppointmentConfirmation(to: string, details: AppointmentEmailDetails) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: "Confirmación de tu cita",
    html: `<p>Tu cita para <strong>${details.serviceName}</strong> con <strong>${details.workerName}</strong> quedó confirmada para el ${details.date} a las ${details.startTime}.</p>`,
  });
}

export async function sendAppointmentCancellation(to: string, details: AppointmentEmailDetails) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: "Cancelación de tu cita",
    html: `<p>Tu cita para <strong>${details.serviceName}</strong> con <strong>${details.workerName}</strong> del ${details.date} a las ${details.startTime} fue cancelada.</p>`,
  });
}

export async function sendAppointmentReminder(to: string, details: AppointmentEmailDetails) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: "Recordatorio de tu cita mañana",
    html: `<p>Recordatorio: tienes una cita para <strong>${details.serviceName}</strong> con <strong>${details.workerName}</strong> el ${details.date} a las ${details.startTime}.</p>`,
  });
}
