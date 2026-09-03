'use client';

import { Component, type ReactNode } from 'react';

// Aísla fallos de un widget secundario (p.ej. un efecto visual) para que
// nunca puedan tirar abajo el resto de la tablet. Si algo dentro falla,
// esta pieza simplemente desaparece en vez de romper la página entera.
export default class SilentErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[SilentErrorBoundary] fallo aislado, no afecta al resto de la tablet:', error);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
