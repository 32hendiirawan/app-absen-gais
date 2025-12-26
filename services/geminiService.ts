
import { GoogleGenAI } from "@google/genai";
import { AttendanceStatus, User, AttendanceRecord } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateWhatsAppMessage = async (student: User, status: AttendanceStatus, timestamp: number, note?: string) => {
  const dateStr = new Date(timestamp).toLocaleString('id-ID');
  const prompt = `
    Compose a professional and polite WhatsApp message in Indonesian to a parent notifying them of their child's attendance.
    Student Name: ${student.name}
    Class: ${student.className}
    Status: ${status}
    Time: ${dateStr}
    Notes (if any): ${note || 'None'}

    The tone should be formal yet informative. Keep it concise.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini failed to generate message", error);
    return `Laporan Kehadiran: ${student.name} (${student.className}) status ${status} pada ${dateStr}.`;
  }
};

export const generateReportSummary = async (records: AttendanceRecord[], students: User[]) => {
  const prompt = `
    Analyze the following attendance data for a school and provide a short summary in Indonesian (max 2 paragraphs).
    Total Students: ${students.length}
    Records: ${JSON.stringify(records.slice(0, 50))} // Sending sample of records
    Identify any trends or concerns.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    return "Analisis laporan tidak tersedia saat ini.";
  }
};
