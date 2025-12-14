/**
 * Interface representing Google OAuth2 tokens
 * All fields except access_token are optional as they may not always be present
 * in the OAuth2 response, especially during token refresh operations.
 */
export interface GoogleTokens {
  /** The access token used for API requests */
  access_token: string;
  
  /** The refresh token used to obtain new access tokens */
  refresh_token?: string;
  
  /** The scope of access granted by the token */
  scope?: string;
  
  /** The type of token, typically 'Bearer' */
  token_type?: string;
  
  /** The expiration timestamp of the access token */
  expiry_date?: number;
} 