import React, { createContext, useContext } from 'react';
export const C = createContext();
export const useC = () => useContext(C);
