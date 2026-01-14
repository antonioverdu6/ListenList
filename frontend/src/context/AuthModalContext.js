import React, { createContext, useState, useContext } from 'react';

const AuthModalContext = createContext();

export const useAuthModal = () => useContext(AuthModalContext);

export const AuthModalProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState('login'); // 'login' or 'register'

  const openLogin = () => {
    setView('login');
    setIsOpen(true);
  };

  const openRegister = () => {
    setView('register');
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  return (
    <AuthModalContext.Provider value={{ isOpen, view, openLogin, openRegister, closeModal, setView }}>
      {children}
    </AuthModalContext.Provider>
  );
};
