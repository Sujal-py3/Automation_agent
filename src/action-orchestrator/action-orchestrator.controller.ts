import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ActionOrchestratorService } from './action-orchestrator.service';

interface PerformActionDto {
  userId: string;
  message: string;
}

@Controller('action')
export class ActionOrchestratorController {
  private readonly logger = new Logger(ActionOrchestratorController.name);

  constructor(private readonly actionOrchestratorService: ActionOrchestratorService) {}

  @Post('perform')
  async perform(@Body() dto: PerformActionDto): Promise<string> {
    this.logger.debug('[ACTION] Performing action:', { userId: dto.userId, message: dto.message });
    return this.actionOrchestratorService.orchestrateIntent(dto.userId, dto.message);
  }
} 