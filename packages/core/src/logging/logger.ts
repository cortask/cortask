import fs from "node:fs";
import path from "node:path";

export type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  time: string;
  level: LogLevel;
  message: string;
  subsystem?: string;
}

class Logger {
  private logDir: string | null = null;
  private stream: fs.WriteStream | null = null;
  private currentDate: string | null = null;

  init(logDir: string): void {
    this.logDir = logDir;
    fs.mkdirSync(logDir, { recursive: true });
    this.pruneOldLogs();
  }

  private ensureStream(): fs.WriteStream | null {
    if (!this.logDir) return null;

    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.currentDate) {
      this.stream?.end();
      const logFile = path.join(
        this.logDir,
        `cortask-${today}.log`,
      );
      this.stream = fs.createWriteStream(logFile, { flags: "a" });
      this.currentDate = today;
    }
    return this.stream;
  }

  private write(level: LogLevel, message: string, subsystem?: string): void {
    const entry: LogEntry = {
      time: new Date().toISOString(),
      level,
      message,
      subsystem,
    };

    const stream = this.ensureStream();
    if (stream) {
      stream.write(JSON.stringify(entry) + "\n");
    }
  }

  info(message: string, subsystem?: string): void {
    this.write("info", message, subsystem);
  }

  warn(message: string, subsystem?: string): void {
    this.write("warn", message, subsystem);
  }

  error(message: string, subsystem?: string): void {
    this.write("error", message, subsystem);
  }

  debug(message: string, subsystem?: string): void {
    this.write("debug", message, subsystem);
  }

  private pruneOldLogs(): void {
    if (!this.logDir) return;
    try {
      const files = fs.readdirSync(this.logDir);
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      for (const file of files) {
        if (!file.startsWith("cortask-")) continue;
        const filePath = path.join(this.logDir, file);
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
        }
      }
    } catch {
      // Non-critical
    }
  }

  close(): void {
    this.stream?.end();
    this.stream = null;
  }
}

export const logger = new Logger();
