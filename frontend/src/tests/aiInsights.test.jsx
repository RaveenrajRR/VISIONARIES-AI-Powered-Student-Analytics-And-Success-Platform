import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RiskAnalysisPage } from '../features/analytics/AIInsights';
function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={queryClient}><MemoryRouter><RiskAnalysisPage /></MemoryRouter></QueryClientProvider>);
}
afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
});
describe('AI risk analysis page', () => {
    it('renders real risk summary data and supports a working type filter', async () => {
        const fetchMock = vi.fn().mockImplementation(async (url) => {
            const type = new URL(url, 'http://localhost').searchParams.get('type') || 'all';
            const allItems = [{
                    studentId: 'S0001',
                    displayName: 'Synthetic Student 0001',
                    department: 'Civil',
                    academicRisk: true,
                    academicRiskLevel: 'high',
                    academicReasons: [{ metric: 'attendance_pct', value: 60, reason: 'Attendance is below the threshold.' }],
                    placementRisk: false,
                    placementRiskLevel: 'low',
                    placementReasons: [],
                }];
            const items = type === 'placement' ? [] : allItems;
            return {
                ok: true,
                status: 200,
                headers: new Headers({ 'content-type': 'application/json' }),
                json: async () => ({ total: 1, academicRiskCount: 1, placementRiskCount: 0, items }),
            };
        });
        vi.stubGlobal('fetch', fetchMock);
        renderPage();
        expect(await screen.findByText('Synthetic Student 0001')).toBeInTheDocument();
        expect(screen.getByText('Academic support flags')).toBeInTheDocument();
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'placement' } });
        expect(await screen.findByText('No matching risk flags in the authorized records.')).toBeInTheDocument();
    });
    it('shows a visible error state when the AI endpoint is unavailable', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('AI service is unavailable or timed out')));
        renderPage();
        expect(await screen.findByText(/Risk analysis is unavailable/)).toBeInTheDocument();
    });
});
