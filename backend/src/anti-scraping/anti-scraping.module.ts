import { Module } from '@nestjs/common';
import { ThreatDetectorService } from './threat-detector.service';
import { AntiScrapingGuard } from './anti-scraping.guard';
import { AntiScrapingController } from './anti-scraping.controller';

@Module({
  controllers: [AntiScrapingController],
  providers: [ThreatDetectorService, AntiScrapingGuard],
  exports: [ThreatDetectorService],
})
export class AntiScrapingModule {}
