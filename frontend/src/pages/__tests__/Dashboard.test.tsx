import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../ThemeProvider', () => ({
  useTheme: () => ({
    systemName: 'Test TMS',
    hasLogo: false,
    logoUrl: null,
    themeUpdatedAt: null,
    reloadTheme: jest.fn(),
  }),
}));

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

describe('Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the welcome message with system name', () => {
    renderDashboard();
    expect(screen.getByText('Welcome to Test TMS')).toBeInTheDocument();
  });

  it('renders all navigation cards', () => {
    renderDashboard();
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('Carriers')).toBeInTheDocument();
    expect(screen.getByText('Locations')).toBeInTheDocument();
    expect(screen.getByText('Lanes')).toBeInTheDocument();
    expect(screen.getByText('Shipments')).toBeInTheDocument();
  });

  it('navigates to customers page on card click', () => {
    renderDashboard();
    fireEvent.click(screen.getByText('Customers').closest('.card-clickable')!);
    expect(mockNavigate).toHaveBeenCalledWith('/customers');
  });

  it('navigates to carriers page on card click', () => {
    renderDashboard();
    fireEvent.click(screen.getByText('Carriers').closest('.card-clickable')!);
    expect(mockNavigate).toHaveBeenCalledWith('/carriers');
  });

  it('navigates to locations page on card click', () => {
    renderDashboard();
    fireEvent.click(screen.getByText('Locations').closest('.card-clickable')!);
    expect(mockNavigate).toHaveBeenCalledWith('/locations');
  });

  it('navigates to lanes page on card click', () => {
    renderDashboard();
    fireEvent.click(screen.getByText('Lanes').closest('.card-clickable')!);
    expect(mockNavigate).toHaveBeenCalledWith('/lanes');
  });

  it('navigates to shipments page on card click', () => {
    renderDashboard();
    fireEvent.click(screen.getByText('Shipments').closest('.card-clickable')!);
    expect(mockNavigate).toHaveBeenCalledWith('/shipments');
  });

  it('renders card descriptions', () => {
    renderDashboard();
    expect(screen.getByText('Manage your customer database and contact information.')).toBeInTheDocument();
    expect(screen.getByText('Track and manage your transportation shipments.')).toBeInTheDocument();
  });
});
