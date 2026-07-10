import { describe, expect, it, vi, beforeEach } from "vitest";

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn().mockResolvedValue({ id: "email_123" }),
}));
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: sendMock } };
  }),
}));

import { sendAppointmentConfirmation, sendAppointmentCancellation } from "@/lib/email";

describe("email notifications", () => {
  beforeEach(() => sendMock.mockClear());

  it("sends a confirmation email with the appointment details in the body", async () => {
    await sendAppointmentConfirmation("cliente@example.com", {
      serviceName: "Corte",
      workerName: "Luis Gómez",
      date: "2026-07-07",
      startTime: "08:00",
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.to).toBe("cliente@example.com");
    expect(call.subject).toContain("Confirmación");
    expect(call.html).toContain("Corte");
    expect(call.html).toContain("Luis Gómez");
  });

  it("sends a cancellation email", async () => {
    await sendAppointmentCancellation("cliente@example.com", {
      serviceName: "Corte",
      workerName: "Luis Gómez",
      date: "2026-07-07",
      startTime: "08:00",
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].subject).toContain("Cancelación");
  });
});
