import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FeatureCenter from '../features/FeatureCenter';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('FeatureCenter', () => {
  it('renders the study panel while its data is still loading', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <FeatureCenter />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Loading records…')).toBeInTheDocument();
    queryClient.clear();
  });
});
