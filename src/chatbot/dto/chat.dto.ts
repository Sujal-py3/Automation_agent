import { IsNotEmpty, IsString } from 'class-validator';

export class ChatRequestDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;
}

export class ChatResponseDto {
  @IsString()
  @IsNotEmpty()
  response!: string;
} 