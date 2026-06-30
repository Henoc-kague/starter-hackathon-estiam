import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ThreatDetectorService } from './threat-detector.service';

@Injectable()
export class AntiScrapingGuard implements CanActivate {
  constructor(private readonly threatDetector: ThreatDetectorService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip =
      request.headers['x-forwarded-for'] || request.ip || request.connection.remoteAddress;

    // Priorité à l'utilisateur authentifié (posé par AuthGuard via req.user),
    // repli sur le header de test pour les scénarios sans authentification.
    const accountId = request.user?.username || request.headers['x-account-id'];

    const result = this.threatDetector.evaluate(ip, accountId);

    if (!result.allowed) {
      throw new ForbiddenException({
        error: 'Accès bloqué',
        reason: result.reason,
      });
    }

    return true;
  }
}
