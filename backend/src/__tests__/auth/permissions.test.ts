import { PERMISSIONS, SYSTEM_ROLES } from '../../auth/permissions';

describe('Permissions', () => {
  it('defines all expected permission constants', () => {
    expect(PERMISSIONS.ALL).toBe('*');
    expect(PERMISSIONS.SHIPMENTS_READ).toBe('shipments:read');
    expect(PERMISSIONS.LOADBOARD_READ).toBe('loadboard:read');
    expect(PERMISSIONS.LOADBOARD_ASSIGN).toBe('loadboard:assign');
    expect(PERMISSIONS.MARGIN_VIEW).toBe('margin:view');
    expect(PERMISSIONS.CREDIT_CHECK).toBe('credit:check');
    expect(PERMISSIONS.RATE_CONFIRMATION).toBe('rate_confirmation:generate');
  });

  it('all permissions follow resource:action format', () => {
    for (const [key, value] of Object.entries(PERMISSIONS)) {
      if (value === '*') continue;
      expect(value).toMatch(/^[a-z_]+:[a-z_*]+$/);
    }
  });
});

describe('System Roles', () => {
  it('defines expected system roles', () => {
    const roleNames = SYSTEM_ROLES.map(r => r.name);
    expect(roleNames).toContain('admin');
    expect(roleNames).toContain('dispatcher');
    expect(roleNames).toContain('broker_admin');
    expect(roleNames).toContain('broker_agent');
    expect(roleNames).toContain('warehouse');
    expect(roleNames).toContain('readonly');
    expect(roleNames).toContain('finance');
  });

  it('admin has wildcard permission', () => {
    const admin = SYSTEM_ROLES.find(r => r.name === 'admin');
    expect(admin).toBeDefined();
    expect(admin!.permissions).toContain('*');
  });

  it('broker_admin has all broker-specific permissions', () => {
    const brokerAdmin = SYSTEM_ROLES.find(r => r.name === 'broker_admin');
    expect(brokerAdmin).toBeDefined();
    expect(brokerAdmin!.permissions).toContain('loadboard:*');
    expect(brokerAdmin!.permissions).toContain('margin:view');
    expect(brokerAdmin!.permissions).toContain('credit:check');
    expect(brokerAdmin!.permissions).toContain('rate_confirmation:generate');
    expect(brokerAdmin!.permissions).toContain('quotes:*');
    expect(brokerAdmin!.permissions).toContain('charges:*');
  });

  it('broker_agent has loadboard and quoting but not settings', () => {
    const agent = SYSTEM_ROLES.find(r => r.name === 'broker_agent');
    expect(agent).toBeDefined();
    expect(agent!.permissions).toContain('loadboard:*');
    expect(agent!.permissions).toContain('quotes:*');
    expect(agent!.permissions).toContain('margin:view');
    expect(agent!.permissions).not.toContain('settings:*');
    expect(agent!.permissions).not.toContain('users:*');
  });

  it('readonly cannot write', () => {
    const readonly = SYSTEM_ROLES.find(r => r.name === 'readonly');
    expect(readonly).toBeDefined();
    const perms = readonly!.permissions;
    // Should only have :read and :view permissions
    for (const p of perms) {
      if (p === '*') fail('readonly should not have wildcard');
      const action = p.split(':')[1];
      expect(['read', 'view']).toContain(action);
    }
  });

  it('all system roles are marked isSystem', () => {
    for (const role of SYSTEM_ROLES) {
      expect(role.isSystem).toBe(true);
    }
  });

  it('finance role has financial permissions but not admin', () => {
    const finance = SYSTEM_ROLES.find(r => r.name === 'finance');
    expect(finance).toBeDefined();
    expect(finance!.permissions).toContain('quotes:*');
    expect(finance!.permissions).toContain('invoices:*');
    expect(finance!.permissions).toContain('charges:*');
    expect(finance!.permissions).not.toContain('settings:*');
    expect(finance!.permissions).not.toContain('users:*');
  });
});

describe('seedSystemRoles', () => {
  it('can be imported', async () => {
    const { seedSystemRoles } = await import('../../auth/seedRoles');
    expect(typeof seedSystemRoles).toBe('function');
  });
});
