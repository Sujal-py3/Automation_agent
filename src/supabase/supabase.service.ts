import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleTokens } from '../common/interfaces/google-tokens.interface';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private supabase!: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    this.validateConfiguration();
    this.initializeSupabaseClient();
  }

  private validateConfiguration(): void {
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_KEY',
    ];

    const missingVars = requiredEnvVars.filter(
      (envVar) => !this.configService.get<string>(envVar),
    );

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}`,
      );
    }

    this.logger.debug('[SUPABASE] Configuration validated successfully');
  }

  private initializeSupabaseClient(): void {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and key are required');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.logger.debug('[SUPABASE] Client initialized successfully');
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  async createOrUpdateUserByEmail(
    email: string,
    name: string,
    tokens: GoogleTokens,
    whatsappNumber?: string // optional param
  ): Promise<{ id: string }> {
    try {
      this.logger.debug('[SUPABASE] Creating/updating user:', { email });
  
      const { data: existingUser, error: fetchError } = await this.supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();
  
      if (fetchError && fetchError.code !== 'PGRST116') {
        this.logger.error('[SUPABASE] Error checking existing user:', fetchError);
        throw fetchError;
      }
  
      if (existingUser) {
        this.logger.debug('[SUPABASE] Updating existing user:', { id: existingUser.id });
  
        const { error: updateError } = await this.supabase
          .from('users')
          .update({
            name,
            google_access_token: tokens.access_token,
            google_refresh_token: tokens.refresh_token ?? null,
            google_token_expiry: tokens.expiry_date
              ? new Date(tokens.expiry_date).toISOString()
              : null,
            ...(whatsappNumber && { whatsapp_number: whatsappNumber }), // 🧩 optional update
          })
          .eq('id', existingUser.id);
  
        if (updateError) {
          this.logger.error('[SUPABASE] Error updating user:', updateError);
          throw updateError;
        }
  
        return { id: existingUser.id };
      }
  
      this.logger.debug('[SUPABASE] Creating new user:', { email });
  
      const { data: newUser, error: insertError } = await this.supabase
        .from('users')
        .insert({
          email,
          name,
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token ?? null,
          google_token_expiry: tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null,
          ...(whatsappNumber && { whatsapp_number: whatsappNumber }), // 🧩 set on create too
        })
        .select('id')
        .single();
  
      if (insertError) {
        this.logger.error('[SUPABASE] Error creating user:', insertError);
        throw insertError;
      }
  
      this.logger.debug('[SUPABASE] User created successfully:', { id: newUser.id });
      return { id: newUser.id };
    } catch (error) {
      this.logger.error('[SUPABASE] Failed to create/update user:', error);
      throw error;
    }
  }
  
}  