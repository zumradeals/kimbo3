/**
 * Structured Logger pour Edge Functions KPM
 * Fournit un logging structuré et traçable
 */

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  function_name: string;
  action: string;
  user_id?: string;
  caller_id?: string;
  target_id?: string;
  result: "success" | "failure" | "blocked";
  duration_ms?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Logger structuré pour les edge functions
 */
export class StructuredLogger {
  private functionName: string;
  private startTime: number;

  constructor(functionName: string) {
    this.functionName = functionName;
    this.startTime = Date.now();
  }

  private formatLog(entry: Partial<LogEntry>): string {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: entry.level || "INFO",
      function_name: this.functionName,
      action: entry.action || "unknown",
      result: entry.result || "success",
      ...entry
    };

    if (entry.duration_ms === undefined) {
      logEntry.duration_ms = Date.now() - this.startTime;
    }

    return JSON.stringify(logEntry);
  }

  debug(action: string, metadata?: Record<string, unknown>): void {
    console.log(this.formatLog({ level: "DEBUG", action, result: "success", metadata }));
  }

  info(action: string, metadata?: Record<string, unknown>): void {
    console.log(this.formatLog({ level: "INFO", action, result: "success", metadata }));
  }

  warn(action: string, metadata?: Record<string, unknown>): void {
    console.warn(this.formatLog({ level: "WARN", action, result: "success", metadata }));
  }

  error(action: string, error: Error | string, metadata?: Record<string, unknown>): void {
    const errorMessage = error instanceof Error ? error.message : error;
    console.error(this.formatLog({ 
      level: "ERROR", 
      action, 
      result: "failure", 
      error: errorMessage,
      metadata 
    }));
  }

  /**
   * Log une action utilisateur avec contexte complet
   */
  logUserAction(params: {
    action: string;
    caller_id?: string;
    target_id?: string;
    result: "success" | "failure" | "blocked";
    error?: string;
    metadata?: Record<string, unknown>;
  }): void {
    const entry = this.formatLog({
      level: params.result === "failure" ? "ERROR" : params.result === "blocked" ? "WARN" : "INFO",
      action: params.action,
      caller_id: params.caller_id,
      target_id: params.target_id,
      result: params.result,
      error: params.error,
      metadata: params.metadata
    });
    
    if (params.result === "failure") {
      console.error(entry);
    } else if (params.result === "blocked") {
      console.warn(entry);
    } else {
      console.log(entry);
    }
  }

  /**
   * Log le démarrage de la fonction
   */
  start(metadata?: Record<string, unknown>): void {
    this.startTime = Date.now();
    this.info("function_start", metadata);
  }

  /**
   * Log la fin de la fonction
   */
  end(result: "success" | "failure", metadata?: Record<string, unknown>): void {
    const level = result === "failure" ? "ERROR" : "INFO";
    console[level === "ERROR" ? "error" : "log"](
      this.formatLog({ level, action: "function_end", result, metadata })
    );
  }
}

/**
 * Extrait les informations de la requête pour le logging
 */
export function extractRequestInfo(req: Request): Record<string, unknown> {
  return {
    method: req.method,
    url: req.url,
    user_agent: req.headers.get("user-agent"),
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
        req.headers.get("x-real-ip") || 
        "unknown"
  };
}
