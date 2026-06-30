import { Injectable } from '@nestjs/common';

interface IpStats {
  timestamps: number[];
  blockedUntil: number;
  flags: string[];
}

@Injectable()
export class ThreatDetectorService {
  private readonly maxRequests = 15;
  private readonly windowMs = 10_000; // 10 secondes
  private readonly blockDurationMs = 60_000; // 60 secondes

  private ipStats = new Map<string, IpStats>();
  private activeSessions = new Map<string, Map<string, number>>();
  private readonly sessionTtlMs = 30_000;

  private knownVpnPrefixes = ['10.66.', '172.31.99.'];
  public eventLog: any[] = [];

  private getStats(ip: string): IpStats {
    if (!this.ipStats.has(ip)) {
      this.ipStats.set(ip, { timestamps: [], blockedUntil: 0, flags: [] });
    }
    return this.ipStats.get(ip)!;
  }

  private flag(ip: string, type: string, detail: string) {
    const event = { ts: Date.now(), ip, type, detail };
    this.eventLog.push(event);
    this.getStats(ip).flags.push(type);
  }

  isBlocked(ip: string): boolean {
    return Date.now() < this.getStats(ip).blockedUntil;
  }

  private block(ip: string, reason: string) {
    this.getStats(ip).blockedUntil = Date.now() + this.blockDurationMs;
    this.flag(ip, 'BLOCKED', reason);
  }

  private checkRate(ip: string): boolean {
    const now = Date.now();
    const stats = this.getStats(ip);
    stats.timestamps.push(now);
    stats.timestamps = stats.timestamps.filter((t) => now - t <= this.windowMs);

    if (stats.timestamps.length > this.maxRequests) {
      this.flag(ip, 'RATE_LIMIT_EXCEEDED', `${stats.timestamps.length} req/${this.windowMs / 1000}s`);
      return true;
    }
    return false;
  }

  private checkVpn(ip: string): boolean {
    for (const prefix of this.knownVpnPrefixes) {
      if (ip.startsWith(prefix)) {
        this.flag(ip, 'VPN_DETECTED', `IP dans la plage ${prefix}`);
        return true;
      }
    }
    return false;
  }

  private checkConcurrentSessions(accountId: string, ip: string): boolean {
    const now = Date.now();
    if (!this.activeSessions.has(accountId)) {
      this.activeSessions.set(accountId, new Map());
    }
    const sessions = this.activeSessions.get(accountId)!;
    sessions.set(ip, now);

    for (const [sessionIp, ts] of sessions) {
      if (now - ts > this.sessionTtlMs) sessions.delete(sessionIp);
    }

    if (sessions.size > 1) {
      this.flag(ip, 'CONCURRENT_SESSIONS', `compte ${accountId} actif depuis ${sessions.size} IP`);
      return true;
    }
    return false;
  }

  evaluate(ip: string, accountId?: string): { allowed: boolean; reason: string[] | null } {
    if (this.isBlocked(ip)) {
      return { allowed: false, reason: ['IP déjà bloquée'] };
    }

    const triggered: string[] = [];
    if (this.checkRate(ip)) triggered.push('rate_limit');
    if (this.checkVpn(ip)) triggered.push('vpn');
    if (accountId && this.checkConcurrentSessions(accountId, ip)) {
      triggered.push('concurrent_sessions');
    }

    if (triggered.length > 0) {
      this.block(ip, triggered.join(','));
      return { allowed: false, reason: triggered };
    }

    return { allowed: true, reason: null };
  }

  getDashboard() {
    const blockedIps: string[] = [];
    for (const [ip] of this.ipStats) {
      if (this.isBlocked(ip)) blockedIps.push(ip);
    }
    return {
      totalEvents: this.eventLog.length,
      blockedIps,
      trackedIps: this.ipStats.size,
    };
  }
}
