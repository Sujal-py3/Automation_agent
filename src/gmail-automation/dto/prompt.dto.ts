import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class PromptDto {
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @IsUUID()
  @IsNotEmpty()
  userId!: string;
} 