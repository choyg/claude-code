const BASE_CONFIG = {
  REDIRECT_PORT: 54545,
  MANUAL_REDIRECT_URL: '/oauth/code/callback',
  SCOPES: ['org:create_api_key', 'user:profile'] as const,
}

// Production OAuth configuration - Used in normal operation
const PROD_OAUTH_CONFIG = {
  ...BASE_CONFIG,
  AUTHORIZE_URL: 'https://console.anthropic.com/oauth/authorize',
  TOKEN_URL: 'https://console.anthropic.com/v1/oauth/token',
  API_KEY_URL: 'https://api.anthropic.com/api/oauth/claude_cli/create_api_key',
  SUCCESS_URL:
    'https://console.anthropic.com/buy_credits?returnUrl=/oauth/code/success',
  CLIENT_ID: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
} as const

// Only include staging config in ant builds with staging flag
export const STAGING_OAUTH_CONFIG =
  process.env.USER_TYPE === 'ant' && process.env.USE_STAGING_OAUTH === '1'
    ? ({
        ...BASE_CONFIG,
        AUTHORIZE_URL: 'https://console.staging.ant.dev/oauth/authorize',
        TOKEN_URL: 'https://console.staging.ant.dev/v1/oauth/token',
        API_KEY_URL:
          'https://api-staging.anthropic.com/api/oauth/claude_cli/create_api_key',
        SUCCESS_URL:
          'https://console.staging.ant.dev/buy_credits?returnUrl=/oauth/code/success',
        CLIENT_ID: '22422756-60c9-4084-8eb7-27705fd5cf9a',
      } as const)
    : undefined

// Only include test config in test environments
const TEST_OAUTH_CONFIG =
  process.env.NODE_ENV === 'test'
    ? ({
        ...BASE_CONFIG,
        AUTHORIZE_URL: 'http://localhost:3456/oauth/authorize',
        TOKEN_URL: 'http://localhost:3456/oauth/token',
        API_KEY_URL: '',
        SUCCESS_URL:
          'http://localhost:3456/buy_credits?returnUrl=/oauth/code/success',
        REDIRECT_PORT: 7777,
        CLIENT_ID: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
      } as const)
    : undefined

// Default to prod config, override with test/staging if enabled
export const OAUTH_CONFIG =
  (process.env.NODE_ENV === 'test' && TEST_OAUTH_CONFIG) ||
  (process.env.USER_TYPE === 'ant' &&
    process.env.USE_STAGING_OAUTH === '1' &&
    STAGING_OAUTH_CONFIG) ||
  PROD_OAUTH_CONFIG
