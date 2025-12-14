import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { GoogleTokens } from '../common/interfaces/google-tokens.interface';

interface GoogleProfile {
  email: string;
  name: string;
}

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private oauth2Client: OAuth2Client;

  constructor(private readonly configService: ConfigService) {
    this.oauth2Client = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.get<string>('GOOGLE_REDIRECT_URI'),
    );
    this.logger.debug('[GOOGLE] OAuth client initialized');
  }

  getLoginUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    const url = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force consent screen to ensure we get refresh token
    });

    this.logger.debug('[GOOGLE] Generated login URL with scopes:', { scopes });
    return url;
  }

  async exchangeCode(code: string): Promise<GoogleTokens> {
    try {
      this.logger.debug('[GOOGLE] Exchanging code for tokens');
      
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (!tokens.access_token) {
        throw new Error('No access token received');
      }

      this.logger.debug('[GOOGLE] Successfully exchanged code for tokens', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiryDate: tokens.expiry_date,
      });

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? undefined,
        scope: tokens.scope ?? undefined,
        token_type: tokens.token_type ?? undefined,
        expiry_date: tokens.expiry_date ?? undefined,
      };
    } catch (error) {
      this.logger.error('[GOOGLE] Failed to exchange code:', this.extractErrorMessage(error));
      throw error;
    }
  }

  async getUserProfile(accessToken: string): Promise<GoogleProfile> {
    try {
      this.logger.debug('[GOOGLE] Fetching user profile');
      
      // Create a new OAuth2 client instance for this request
      const client = new google.auth.OAuth2(
        this.configService.get<string>('GOOGLE_CLIENT_ID'),
        this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
        this.configService.get<string>('GOOGLE_REDIRECT_URI'),
      );

      // Set credentials before creating the oauth2 instance
      client.setCredentials({
        access_token: accessToken,
      });

      this.logger.debug('[GOOGLE] OAuth2 client credentials:', {
        hasAccessToken: !!client.credentials.access_token,
        tokenType: client.credentials.token_type,
      });

      // Create oauth2 instance with the configured client
      const oauth2 = google.oauth2({
        version: 'v2',
        auth: client,
      });

      // Get user info without passing auth again
      const { data } = await oauth2.userinfo.get();

      if (!data.email || !data.name) {
        throw new Error('Incomplete user profile data');
      }

      this.logger.debug('[GOOGLE] Successfully fetched user profile', {
        email: data.email,
        name: data.name,
      });

      return {
        email: data.email,
        name: data.name,
      };
    } catch (error) {
      this.logger.error('[GOOGLE] Failed to fetch user profile:', this.extractErrorMessage(error));
      throw error;
    }
  }

  private extractErrorMessage(error: any): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error occurred';
  }
} 