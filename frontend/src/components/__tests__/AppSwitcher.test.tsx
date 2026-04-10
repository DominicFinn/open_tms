import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import AppSwitcher from '../AppSwitcher';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function renderSwitcher(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppSwitcher />
    </MemoryRouter>
  );
}

describe('AppSwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the toggle button', () => {
    renderSwitcher();
    expect(screen.getByLabelText('Switch app')).toBeInTheDocument();
  });

  it('dropdown is hidden by default', () => {
    renderSwitcher();
    expect(screen.queryByText('Switch to')).not.toBeInTheDocument();
  });

  it('opens dropdown on click', () => {
    renderSwitcher();
    fireEvent.click(screen.getByLabelText('Switch app'));
    expect(screen.getByText('Switch to')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Integrations')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('navigates to Integrations on click', () => {
    renderSwitcher();
    fireEvent.click(screen.getByLabelText('Switch app'));
    fireEvent.click(screen.getByText('Integrations'));
    expect(mockNavigate).toHaveBeenCalledWith('/integrations');
  });

  it('navigates to Admin on click', () => {
    renderSwitcher();
    fireEvent.click(screen.getByLabelText('Switch app'));
    fireEvent.click(screen.getByText('Admin'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin');
  });

  it('navigates to Operations on click', () => {
    renderSwitcher();
    fireEvent.click(screen.getByLabelText('Switch app'));
    fireEvent.click(screen.getByText('Operations'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('closes dropdown after selection', () => {
    renderSwitcher();
    fireEvent.click(screen.getByLabelText('Switch app'));
    expect(screen.getByText('Switch to')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Admin'));
    expect(screen.queryByText('Switch to')).not.toBeInTheDocument();
  });

  it('shows app descriptions', () => {
    renderSwitcher();
    fireEvent.click(screen.getByLabelText('Switch app'));
    expect(screen.getByText('Shipments, orders, lanes & carriers')).toBeInTheDocument();
    expect(screen.getByText('API keys, webhooks, EDI & outbound')).toBeInTheDocument();
    expect(screen.getByText('Settings, theme, templates & fields')).toBeInTheDocument();
  });
});
