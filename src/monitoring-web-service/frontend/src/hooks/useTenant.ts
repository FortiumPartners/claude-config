import { useContext } from 'react';
import { TenantContext } from '../contexts/TenantContext';

// Hook to use tenant context
export function useTenant() {
  const context = useContext(TenantContext);
  
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  
  return context;
}