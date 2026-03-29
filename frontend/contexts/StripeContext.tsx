import React, { createContext, useContext } from 'react';
import { StripeProvider as StripeProviderNative } from '@stripe/stripe-react-native';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

interface StripeContextType {
  isReady: boolean;
}

const StripeContext = createContext<StripeContextType>({ isReady: false });

export const useStripeContext = () => useContext(StripeContext);

export const StripeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <StripeProviderNative publishableKey={STRIPE_PUBLISHABLE_KEY}>
      <StripeContext.Provider value={{ isReady: true }}>
        {children}
      </StripeContext.Provider>
    </StripeProviderNative>
  );
};
