import { getApiUrl, setAuthToken, getAuthToken } from '../../services/api';

describe('API Service', () => {
  beforeEach(() => {
    setAuthToken(null);
  });

  it('should set and get auth token', () => {
    expect(getAuthToken()).toBeNull();
    
    setAuthToken('test-token-123');
    expect(getAuthToken()).toBe('test-token-123');
  });

  it('should clear auth token', () => {
    setAuthToken('test-token');
    expect(getAuthToken()).toBe('test-token');
    
    setAuthToken(null);
    expect(getAuthToken()).toBeNull();
  });

  it('should return API URL', () => {
    const apiUrl = getApiUrl();
    expect(apiUrl).toContain('/api');
  });
});
