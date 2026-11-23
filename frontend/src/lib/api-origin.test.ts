import { describe, expect, it } from 'vitest';
import { apiOrigin } from './api-origin.mjs';

describe('apiOrigin', () => {
  it('keeps the convenient localhost default in development', () => {
    expect(apiOrigin({ NODE_ENV: 'development' })).toBe('http://localhost:4000');
  });

  it('accepts a configured preview origin', () => {
    expect(apiOrigin({ NODE_ENV: 'production', VERCEL_ENV: 'preview', API_URL: 'https://api-preview.example.com/' }))
      .toBe('https://api-preview.example.com');
  });

  it.each([
    {},
    { API_URL: 'not a url' },
    { API_URL: 'http://localhost:4000' },
    { API_URL: 'https://api.example.com/v1' },
    { API_URL: 'http://api.example.com' },
  ])('rejects invalid production origins %#', (values) => {
    expect(() => apiOrigin({ NODE_ENV: 'production', ...values })).toThrow(/API_URL/);
  });

  it('accepts an HTTPS production origin', () => {
    expect(apiOrigin({ NODE_ENV: 'production', API_URL: 'https://api.example.com' }))
      .toBe('https://api.example.com');
  });
});
