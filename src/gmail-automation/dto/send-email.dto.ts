import { IsEmail, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class SendEmailDto {
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @IsEmail()
  @IsNotEmpty()
  to!: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;
} 