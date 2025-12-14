import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthController } from './auth.controller';
import { GoogleAuthService } from './google-auth.service';

@Module({
  imports: [CommonModule],
  providers: [GoogleAuthService, SupabaseService],
  controllers: [AuthController],
  exports: [GoogleAuthService],
})
export class AuthModule {} 