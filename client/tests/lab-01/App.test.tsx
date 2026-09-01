import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SystemCheckPage as App } from '../../src/pages/SystemCheckPage';

describe('App', () => {
  it('renders the TokTickIT heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /TokTickIT/i })).toBeInTheDocument();
  });
});
