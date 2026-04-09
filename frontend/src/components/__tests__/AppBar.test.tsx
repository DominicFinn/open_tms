import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import AppBar from '../AppBar';

// Mock ThemeProvider
jest.mock('../../ThemeProvider', () => ({
  useTheme: () => ({
    hasLogo: false,
    logoUrl: null,
    systemName: 'Open TMS',
    themeUpdatedAt: null,
    reloadTheme: jest.fn(),
  }),
}));

// Mock AppSwitcher since it has its own tests
jest.mock('../AppSwitcher', () => ({
  __esModule: true,
  default: function MockAppSwitcher() {
    return React.createElement('div', { 'data-testid': 'app-switcher' });
  },
}));

function renderAppBar(props?: Partial<React.ComponentProps<typeof AppBar>>) {
  const defaultProps = {
    title: 'Operations',
    icon: 'local_shipping',
    onToggleMobileMenu: jest.fn(),
  };
  return render(
    <MemoryRouter>
      <AppBar {...defaultProps} {...props} />
    </MemoryRouter>
  );
}

describe('AppBar', () => {
  it('renders the title', () => {
    renderAppBar({ title: 'My Dashboard' });
    expect(screen.getByText('My Dashboard')).toBeInTheDocument();
  });

  it('renders the icon', () => {
    renderAppBar({ icon: 'dashboard' });
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });

  it('renders the mobile menu button', () => {
    renderAppBar();
    expect(screen.getByLabelText('Toggle menu')).toBeInTheDocument();
  });

  it('calls onToggleMobileMenu when hamburger is clicked', () => {
    const onToggle = jest.fn();
    renderAppBar({ onToggleMobileMenu: onToggle });
    fireEvent.click(screen.getByLabelText('Toggle menu'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders notification and account buttons', () => {
    renderAppBar();
    expect(screen.getByText('notifications')).toBeInTheDocument();
    expect(screen.getByText('account_circle')).toBeInTheDocument();
  });

  it('renders the AppSwitcher', () => {
    renderAppBar();
    expect(screen.getByTestId('app-switcher')).toBeInTheDocument();
  });

  it('does not render logo when hasLogo is false', () => {
    renderAppBar();
    expect(screen.queryByAltText('Logo')).not.toBeInTheDocument();
  });
});
