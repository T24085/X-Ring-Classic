import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PitchDeckLanding from '../PitchDeckLanding';

describe('PitchDeckLanding', () => {
  it('renders the first slide and allows navigation', () => {
    render(
      <MemoryRouter>
        <PitchDeckLanding />
      </MemoryRouter>
    );

    expect(screen.getByText(/The Marketing Deck for Prospective X-Ring Classic Ranges/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Bring national visibility to your local range/i)[0]).toBeInTheDocument();

    const nextButtons = screen.getAllByRole('button', { name: /next/i });
    fireEvent.click(nextButtons[0]);

    expect(screen.getAllByText(/Deliver a Premium Match-Day Experience/i)[0]).toBeInTheDocument();
  });
});
