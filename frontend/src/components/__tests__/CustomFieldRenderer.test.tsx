import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CustomFieldRenderer from '../CustomFieldRenderer';

const mockFields = {
  data: {
    id: 'version-1',
    fields: [
      { fieldKey: 'priority', label: 'Priority', fieldType: 'text', required: true },
      { fieldKey: 'weight', label: 'Total Weight', fieldType: 'decimal', required: false, config: { decimalPlaces: 2 } },
      { fieldKey: 'is_fragile', label: 'Fragile', fieldType: 'boolean', required: false },
      { fieldKey: 'category', label: 'Category', fieldType: 'list', required: false, config: { options: ['Standard', 'Express', 'Priority'] } },
      { fieldKey: 'tags', label: 'Tags', fieldType: 'multi_list', required: false, config: { options: ['Urgent', 'International', 'Oversized'] } },
    ],
  },
};

describe('CustomFieldRenderer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing while loading', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => new Promise(() => {}), // never resolves
    });

    const { container } = render(
      <CustomFieldRenderer entityType="order" values={{}} />
    );

    // While loading, renders null
    expect(container.querySelector('h4')).toBeNull();
  });

  it('renders nothing when no fields are defined', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({ data: { id: 'v1', fields: [] } }),
    });

    const { container } = await act(async () =>
      render(<CustomFieldRenderer entityType="order" values={{}} />)
    );

    await waitFor(() => {
      expect(container.querySelector('h4')).toBeNull();
    });
  });

  it('renders read-only field values', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockFields),
    });

    await act(async () => {
      render(
        <CustomFieldRenderer
          entityType="order"
          values={{ priority: 'High', is_fragile: true }}
          editable={false}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Custom Fields')).toBeInTheDocument();
      expect(screen.getByText('Priority')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByText('Yes')).toBeInTheDocument();
    });
  });

  it('renders editable text input', async () => {
    const onChange = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({
        data: {
          id: 'v1',
          fields: [{ fieldKey: 'note', label: 'Note', fieldType: 'text', required: false }],
        },
      }),
    });

    await act(async () => {
      render(
        <CustomFieldRenderer
          entityType="order"
          values={{ note: '' }}
          onChange={onChange}
          editable={true}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Note')).toBeInTheDocument();
    });
  });

  it('renders boolean field as "No" when false', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({
        data: {
          id: 'v1',
          fields: [{ fieldKey: 'flag', label: 'Active', fieldType: 'boolean', required: false }],
        },
      }),
    });

    await act(async () => {
      render(
        <CustomFieldRenderer entityType="order" values={{ flag: false }} editable={false} />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('No')).toBeInTheDocument();
    });
  });

  it('fetches by version ID when provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({ data: { id: 'v2', fields: [] } }),
    });

    await act(async () => {
      render(
        <CustomFieldRenderer entityType="order" versionId="v2" values={{}} />
      );
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/custom-fields/versions/v2')
      );
    });
  });

  it('fetches active version when no versionId provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({ data: { id: 'active', fields: [] } }),
    });

    await act(async () => {
      render(
        <CustomFieldRenderer entityType="shipment" values={{}} />
      );
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/custom-fields/shipment')
      );
    });
  });

  it('handles fetch error gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('fail'));

    const { container } = await act(async () =>
      render(<CustomFieldRenderer entityType="order" values={{}} />)
    );

    await waitFor(() => {
      // Should render nothing on error
      expect(container.querySelector('h4')).toBeNull();
    });
  });
});
